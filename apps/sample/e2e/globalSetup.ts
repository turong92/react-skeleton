import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TestProject } from 'vitest/node'
import { FAKE_LINE, FAKE_X, startFakeProviders, type FakeProviders } from './fakeProviders'
import { FAKE_KAKAOPAY, startFakeKakaoPay, type FakeKakaoPay } from './fakeKakaoPay'
import { FAKE_NAVERPAY, startFakeNaverPay, type FakeNaverPay } from './fakeNaverPay'
import { FAKE_CLOUDFLARE, startFakeCloudflare, type FakeCloudflare } from './fakeCloudflare'
import { FAKE_GA, startFakeGa, type FakeGa } from './fakeGa'
import { FAKE_PADDLE, startFakePaddle, type FakePaddle } from './fakePaddle'
import { FAKE_TOSS, startFakeToss, type FakeToss } from './fakeToss'
import { PAYMENT_E2E_SKELETON } from './paymentE2eConfig'

/*
 * e2e 준비 — 1) 백엔드(kotlin-skeleton 의 `scripts/sample-e2e-backend.sh start`: 새 DB · 로컬 S3 · apps/sample 기동, 준비되면 `READY <주소>` 한 줄을 찍는다)
 * 2) 이 앱의 Vite 개발 서버(빈 포트, 그 백엔드로 /api/v1 프록시) 3) 테스트에 두 주소를 준다. 끝나면 둘 다 내린다.
 *
 * 메일: 백엔드의 `sample-e2e-backend.sh` 가 mailpit(compose `mail` 프로필)도 함께 올리고 `MAIL smtp=localhost:<포트> api=<주소>` 한 줄을 찍는다 —
 *   이 준비 단계는 빈 포트(`MAIL_SMTP_PORT` · `MAIL_HTTP_PORT`)를 넘겨 그 줄의 api 주소를 테스트에 주고, 테스트는 그 HTTP API 에서 링크를 읽는다(자체 캐처를 띄우지 않는다).
 *   E2E_MAIL_URL 을 주면 이미 떠 있는 캐처를 쓴다(그때는 백엔드의 메일 포트를 E2E_MAIL_SMTP_PORT 로 맞춘다).
 *
 * 가짜 소셜 제공자: 기본으로 켠다 — 백엔드를 올리기 전에 가짜 LINE · X 를 띄우고 그 주소로 백엔드의 LINE · X 설정(`SPRING_APPLICATION_JSON`)을 덮는다
 *   (`auth-social-oidc` · `auth-social-x` 모듈이 있는 백엔드용; `E2E_FAKE_PROVIDERS=0` 이면 끄고 소셜 시나리오는 건너뛴다). 약관 재동의 필터를 시험하려면 `SKELETON_LEGAL_RECONSENT_ENABLED=true`(로컬 프로필은 꺼 둔다).
 *
 * 가짜 토스: 기본으로 켠다 — 백엔드를 올리기 전에 가짜 토스(`fakeToss.ts`)를 띄우고 백엔드가 그것을 보게 한다(`SKELETON_PAYMENT_TOSS_BASE_URL` · `_SECRET_KEY` · `_CLIENT_KEY` · `_ENABLED`,
 *   운영자 경로 `SKELETON_PAYMENT_ADMIN_ENABLED`, 그리고 `SPRING_APPLICATION_JSON` 의 `skeleton.payment` · `skeleton.http.clients.payment-toss` — 조회 작업이 곧 돌고(`reconcile.first-delay`) 결제 가능 시간이 짧다(`checkout-ttl`), 결제사 응답 제한은 첫 조회보다 짧다(`response-timeout`),
 *   주문 만들기 요청 수 한도(계정 10 · IP 30 / 10분)를 푼다(`http.order-rate-limit`), 웹훅 주소 조각(`webhook.path-token`) — 값은 `paymentE2eConfig.ts`).
 *   `payment-jdbc` · `payment-toss` 가 없는 백엔드에서는 이 값들이 쓰이지 않고 결제 시나리오는 건너뛴다. `E2E_FAKE_TOSS=0` 이면 끈다.
 *
 * 가짜 카카오페이: 가짜 토스와 함께 켠다(`E2E_FAKE_KAKAOPAY=0` 이면 끈다) - 백엔드의 카카오페이 설정(`SKELETON_PAYMENT_KAKAOPAY_*`)이 이 서버를 본다. 돌아올 주소(`RETURN_URL`)는 이 서버의 `/return` 이고, 앱(Vite)이 뜬 뒤 그 주소를 알려 준다 -
 *   백엔드는 앱보다 먼저 떠서 앱의 주소를 모르기 때문이다. 토스와 둘 다 켜지면 같은 나라(KR)에 결제사가 둘이라 응원하기에 「결제 방법」 고르기가 생긴다(`GET /payments/config` 의 `choices`).
 *
 * 가짜 네이버페이: 가짜 토스와 함께 켠다(`E2E_FAKE_NAVERPAY=0` 이면 끈다) - 백엔드의 네이버페이 설정(`SKELETON_PAYMENT_NAVERPAY_*`)이 이 서버를 본다(결제 예약 API 와 결제창 `/payments/<예약 번호>` 둘 다 이 서버).
 *   돌아올 주소(`RETURN_URL`)는 이 서버의 `/return` 이고 앱이 뜬 뒤 그 주소를 알려 준다(카카오페이와 같다). 인증값은 가맹 심사 뒤에야 나오므로 진짜 네이버페이로는 돌려 볼 수 없다. 토스 · 카카오페이와 셋이 켜지면 「결제 방법」 고르기에 셋이 보인다.
 *
 * 가짜 Paddle: 가짜 토스와 함께 켠다(`E2E_FAKE_PADDLE=0` 이면 끈다) - `fakePaddle.ts` 가 서명한 웹훅을 백엔드로 쏘고(백엔드 주소는 기동 뒤 알려 준다) 백엔드의 Paddle 설정(`SKELETON_PAYMENT_PADDLE_*` · `PADDLE_*`)이 이 서버를 본다.
 *
 * 네이티브 백엔드: E2E_NATIVE=1 이면 백엔드 스크립트가 `apps/sample` 을 GraalVM 네이티브로 빌드해 리눅스 컨테이너로 띄운다(JVM 대신 — 같은 시나리오가 네이티브에서도 도는지). 컨테이너 안의 앱이 호스트의 가짜 서버(소셜 · 토스 · Paddle)를
 *   `localhost:<포트>` 로 보도록 그 포트들을 `E2E_NATIVE_FORWARD_PORTS` 로 넘긴다. 첫 빌드는 오래 걸려(몇 분) 기동 제한을 늘린다. 이미 만든 실행 파일은 `E2E_NATIVE_SKIP_BUILD=1`. 나머지는 위와 같다.
 *
 * 환경변수: E2E_API_URL — 이미 떠 있는 백엔드를 쓴다(기동 · 정리를 건너뜀) · SAMPLE_API_DIR — 백엔드 레포 위치(기본: 이 레포 옆 ../kotlin-skeleton)
 */
declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string
    apiUrl: string
    /** 메일 캐처(mailpit)의 HTTP API 주소 — 백엔드가 보낸 메일의 링크를 읽는다 */
    mailUrl: string
    /** 가짜 LINE · X(`fakeProviders.ts`) — `E2E_FAKE_PROVIDERS=0` 이면 빈 문자열 */
    fakeUrl: string
    /** 가짜 토스(`fakeToss.ts`) — `E2E_FAKE_TOSS=0` 이거나 이미 떠 있는 백엔드(`E2E_API_URL`)를 쓰면 빈 문자열 */
    fakeTossUrl: string
    /** 가짜 카카오페이(`fakeKakaoPay.ts`) - `E2E_FAKE_KAKAOPAY=0` 이거나 이미 떠 있는 백엔드를 쓰면 빈 문자열 */
    fakeKakaoPayUrl: string
    /** 가짜 네이버페이(`fakeNaverPay.ts`) - `E2E_FAKE_NAVERPAY=0` 이거나 이미 떠 있는 백엔드를 쓰면 빈 문자열 */
    fakeNaverPayUrl: string
    /** 가짜 Paddle(`fakePaddle.ts`) — `E2E_FAKE_PADDLE=0` 이거나 이미 떠 있는 백엔드를 쓰면 빈 문자열 */
    fakePaddleUrl: string
    /** 가짜 Cloudflare(`fakeCloudflare.ts`) - `E2E_FAKE_ANALYTICS=0` 이거나 이미 떠 있는 백엔드를 쓰면 빈 문자열 */
    fakeCloudflareUrl: string
    /** 가짜 GA(`fakeGa.ts`) - 위와 같다 */
    fakeGaUrl: string
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '..')
const repoRoot = resolve(appDir, '../..')

/** `skeleton.*` 설정 두 덩어리를 합친다 - 같은 키의 객체는 안쪽까지(예: `http.clients` 에 결제사와 대시보드 출처가 같이) */
function mergeSkeleton(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(extra)) {
    const mine = out[key]
    out[key] =
      mine && typeof mine === 'object' && value && typeof value === 'object'
        ? mergeSkeleton(mine as Record<string, unknown>, value as Record<string, unknown>)
        : value
  }
  return out
}

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer()
    server.once('error', fail)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      server.close(() => done(port))
    })
  })
}

async function waitFor(url: string, label: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).status < 500) return
    } catch {
      // 아직
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`${label} did not answer at ${url} within ${timeoutMs / 1000}s`)
}

export default async function setup(project: TestProject) {
  let backendScript: string | null = null
  let backendEnv: NodeJS.ProcessEnv = process.env
  let fake: FakeProviders | null = null
  let fakeToss: FakeToss | null = null
  let fakePaddle: FakePaddle | null = null
  let fakeKakaoPay: FakeKakaoPay | null = null
  let fakeNaverPay: FakeNaverPay | null = null
  let fakeCloudflare: FakeCloudflare | null = null
  let fakeGa: FakeGa | null = null
  let apiUrl = process.env.E2E_API_URL ?? ''
  let mailUrl = process.env.E2E_MAIL_URL ?? ''
  const native = process.env.E2E_NATIVE === '1'
  // 게시판 사진의 공개 주소 `/files/...` 를 vite 가 넘길 곳 - 하네스가 로컬 S3 를 띄우면 그 포트
  let filesTarget = process.env.FILES_PROXY_TARGET
  if (!apiUrl) {
    const apiDir = resolve(process.env.SAMPLE_API_DIR ?? resolve(repoRoot, '../kotlin-skeleton'))
    backendScript = resolve(apiDir, 'scripts/sample-e2e-backend.sh')
    // 빈 포트 셋(백엔드 · DB · 로컬 S3) — 개발 중인 다른 서버와 겹치지 않는다
    const [serverPort, dbPort, s3Port] = [await freePort(), await freePort(), await freePort()]
    filesTarget ??= `http://127.0.0.1:${s3Port}/app`
    const [smtpPort, mailHttpPort] = [
      Number(process.env.E2E_MAIL_SMTP_PORT) || (await freePort()),
      await freePort(),
    ]
    // 가짜 소셜 제공자는 기본으로 켠다 — 표준 e2e 한 번이 소셜 여정까지 돌게(`E2E_FAKE_PROVIDERS=0` 이면 끈다: 소셜 없는 백엔드 구성)
    if (process.env.E2E_FAKE_PROVIDERS !== '0') fake = await startFakeProviders() // IPv4 루프백에서 받는다 — 백엔드(JVM · 네이티브 컨테이너의 socat)는 IPv4 로 오는데 Node 의 `localhost` 는 ::1 만 열 수 있다
    // 가짜 토스도 기본으로 켠다 — 결제 여정(결제창 → 승인 → 조회 → 환불)을 진짜 토스 없이 끝까지(`E2E_FAKE_TOSS=0` 이면 끈다: 결제 없는 백엔드 구성)
    if (process.env.E2E_FAKE_TOSS !== '0') fakeToss = await startFakeToss()
    if (process.env.E2E_FAKE_PADDLE !== '0') fakePaddle = await startFakePaddle()
    if (process.env.E2E_FAKE_KAKAOPAY !== '0') fakeKakaoPay = await startFakeKakaoPay()
    if (process.env.E2E_FAKE_NAVERPAY !== '0') fakeNaverPay = await startFakeNaverPay()
    // 가짜 Cloudflare · GA 도 기본으로 켠다 - 대시보드의 방문 · 유입 · 채널 · 「지금 N명」을 진짜 계정 없이(`E2E_FAKE_ANALYTICS=0` 이면 끈다: 그 걸음은 건너뛴다)
    if (process.env.E2E_FAKE_ANALYTICS !== '0') {
      fakeCloudflare = await startFakeCloudflare()
      fakeGa = await startFakeGa()
    }
    // 링크 로그인 요청은 같은 IP(::1)에서 시간당 10번(`skeleton.auth-magic-link.per-ip`, 넘으면 429)이 한도다 — 이 실행의 시나리오는 한 백엔드에 새 계정을 여럿 만들어 10번을 넘는다. e2e 백엔드에서만 올린다
    // E2E_EMAIL_REAUTH_WINDOW=PT0S: 첫 이메일 등록의 재인증 면제 창을 없앤다 — 「1시간이 지난」 제공자 재동의 길(emailReauth.e2e.ts)을 만들 수 있는 유일한 길. 표준 실행에서는 쓰지 않는다
    // 아이디 정하기 한도(`login-id.claim-limit`: 계정마다 · IP 마다 시간당 10번 - 같은 IP 에서 계정을 여럿 만드는 이 실행은 넘는다)와 실시간 중복 확인의 IP 한도(`check-per-ip`)도 e2e 백엔드에서만 올린다
    const e2eLimits = {
      'auth-magic-link': { 'per-ip': 100 },
      account: {
        // 로그인 시도 한도(계정마다 10 · IP 마다 30 / 10분, 성공도 센다) - 한 IP 에서 같은 시드 계정으로 파일마다 여러 번(화면 로그인은 동의 · 프로필 준비 API 로그인까지 셋씩) 들어오는 이 실행은 넘는다. `login.per-account` 는 재인증 · 비밀번호 바꾸기 · 탈퇴 확인의 시도 한도로도 쓰인다(e2e 백엔드만)
        login: { 'per-account': 1000, 'per-ip': 5000 },
        'login-id': { 'claim-limit': 1000, 'check-per-ip': 5000 },
        ...(process.env.E2E_EMAIL_REAUTH_WINDOW
          ? { email: { 'first-registration-window': process.env.E2E_EMAIL_REAUTH_WINDOW } }
          : {}),
      },
    }
    // 대시보드 출처(C3 키): 외부 주소는 가짜 서버로(`dashboard-cloudflare.base-url` · `dashboard-ga.base-url` · `token-url`), 단일 프로젝트 모드의 키다(프로젝트 모드면 `skeleton.projects.<id>.config.dashboard-cloudflare.*`), 비밀은 환경변수로 준다
    // 대시보드: DB 숫자의 서버 캐시를 5초로(기본 75초 - 결제 뒤 건수 +1 을 기다리는 시험이 그 안에 끝나게). 출처가 가짜일 때만 외부 주소 · 키를 준다 - 가짜 소셜 제공자 스위치와 무관하다
    const dashboardSkeleton: Record<string, unknown> = {
      dashboard: { cache: { db: '5s' } },
      ...(fakeCloudflare && fakeGa
        ? {
            'dashboard-cloudflare': {
              'account-id': FAKE_CLOUDFLARE.accountId,
              'site-tag': FAKE_CLOUDFLARE.siteTag,
              'base-url': fakeCloudflare.url,
            },
            'dashboard-ga': {
              'property-id': FAKE_GA.propertyId,
              'key-event': FAKE_GA.keyEvent,
              'base-url': fakeGa.url,
              'token-url': `${fakeGa.url}/token`,
            },
          }
        : {}),
    }
    // 결제 시나리오가 기다릴 수 있는 시간 안에 끝나게(값과 까닭은 `paymentE2eConfig.ts`) — 응답 제한(10초)도 같이 싣는다: 백엔드는 `reconcile.first-delay` 가 그보다 길지 않으면 기동에 실패한다(스펙 §9.2)
    const e2eSkeleton = {
      ...e2eLimits,
      ...(fakeToss || fakePaddle || fakeKakaoPay || fakeNaverPay ? PAYMENT_E2E_SKELETON : {}),
      // 네이티브 컨테이너에는 호스트 요청의 출발지가 도커가 만든 임의의 주소로 보인다(사설 대역도 아니다) — 접속 나라 헤더를 믿는 프록시를 모든 주소로 연다(이 e2e 백엔드만, 호스트 포트는 로컬에만 열린다)
      ...(native && (fakeToss || fakePaddle || fakeKakaoPay || fakeNaverPay)
        ? {
            web: {
              'client-ip': {
                ...PAYMENT_E2E_SKELETON.web['client-ip'],
                'trusted-proxies': ['0.0.0.0/0', '::/0'],
              },
            },
          }
        : {}),
    }
    const skeletonConfig = mergeSkeleton(e2eSkeleton, dashboardSkeleton)
    const fakeConfig = fake
      ? {
          SPRING_APPLICATION_JSON: JSON.stringify({
            skeleton: {
              ...skeletonConfig,
              'auth-social-oidc': {
                providers: {
                  line: {
                    'client-id': FAKE_LINE.clientId,
                    'client-secret': FAKE_LINE.clientSecret,
                    scopes: ['openid', 'profile', 'email'],
                    // LINE 프리셋은 주소를 믿지 않는다(NEVER) — e2e 백엔드만 가짜 LINE 의 `email_verified` 클레임을 믿어, 같은 이메일 병합 안내(409) 여정을 시험한다
                    'email-trust': 'CLAIM',
                    issuer: `${fake.url}/line`,
                    'authorization-endpoint': `${fake.url}/line/authorize`,
                    'token-endpoint': `${fake.url}/line/token`,
                    'jwks-uri': `${fake.url}/line/certs`,
                  },
                },
              },
              // Google 은 가짜 서버가 없다 — 로그인 화면의 세 번째 버튼(증거 스크린샷)으로만 켠다. 눌러 보는 여정은 LINE · X
              'auth-social': {
                providers: {
                  google: {
                    enabled: true,
                    'client-id': 'google-e2e',
                    'client-secret': 'google-secret',
                  },
                },
              },
              'auth-social-x': {
                'client-id': FAKE_X.clientId,
                'client-secret': FAKE_X.clientSecret,
                'api-base-url': `${fake.url}/x`,
              },
            },
          }),
        }
      : { SPRING_APPLICATION_JSON: JSON.stringify({ skeleton: skeletonConfig }) }
    const tossEnv = fakeToss
      ? {
          SKELETON_PAYMENT_TOSS_ENABLED: 'true',
          SKELETON_PAYMENT_TOSS_BASE_URL: fakeToss.url,
          SKELETON_PAYMENT_TOSS_SECRET_KEY: FAKE_TOSS.secretKey,
          SKELETON_PAYMENT_TOSS_CLIENT_KEY: FAKE_TOSS.clientKey,
          SKELETON_PAYMENT_ADMIN_ENABLED: 'true', // 운영자 경로(`/api/v1/admin/payments`) - 운영자 화면(`operatorPage`)과 API 시험이 쓴다
        }
      : {}
    const paddleEnv = fakePaddle
      ? {
          SKELETON_PAYMENT_PADDLE_ENABLED: 'true',
          PADDLE_BASE_URL: fakePaddle.url,
          PADDLE_API_KEY: FAKE_PADDLE.apiKey,
          PADDLE_CLIENT_TOKEN: FAKE_PADDLE.clientToken,
          PADDLE_WEBHOOK_SECRET: FAKE_PADDLE.webhookSecret,
          PADDLE_ENVIRONMENT: 'sandbox',
          PADDLE_PRICE_BASIC: FAKE_PADDLE.prices.basic.id,
          PADDLE_PRICE_STANDARD: FAKE_PADDLE.prices.standard.id,
          PADDLE_PRICE_PRO: FAKE_PADDLE.prices.pro.id,
          PADDLE_PRICE_CHEER_1000: FAKE_PADDLE.prices.cheer1000.id,
        }
      : {}
    const kakaoEnv = fakeKakaoPay
      ? {
          SKELETON_PAYMENT_KAKAOPAY_ENABLED: 'true',
          SKELETON_PAYMENT_KAKAOPAY_SECRET_KEY: FAKE_KAKAOPAY.secretKey,
          SKELETON_PAYMENT_KAKAOPAY_CID: FAKE_KAKAOPAY.cid,
          SKELETON_PAYMENT_KAKAOPAY_SUBSCRIPTION_CID: FAKE_KAKAOPAY.subscriptionCid,
          SKELETON_PAYMENT_KAKAOPAY_RETURN_URL: `${fakeKakaoPay.url}/return`,
          SKELETON_PAYMENT_KAKAOPAY_BASE_URL: fakeKakaoPay.url,
        }
      : {}
    const naverEnv = fakeNaverPay
      ? {
          SKELETON_PAYMENT_NAVERPAY_ENABLED: 'true',
          SKELETON_PAYMENT_NAVERPAY_MODE: 'development',
          SKELETON_PAYMENT_NAVERPAY_CLIENT_ID: FAKE_NAVERPAY.clientId,
          SKELETON_PAYMENT_NAVERPAY_CLIENT_SECRET: FAKE_NAVERPAY.clientSecret,
          SKELETON_PAYMENT_NAVERPAY_CHAIN_ID: FAKE_NAVERPAY.chainId,
          SKELETON_PAYMENT_NAVERPAY_RECURRENT_CLIENT_ID: FAKE_NAVERPAY.recurrent.clientId,
          SKELETON_PAYMENT_NAVERPAY_RECURRENT_CLIENT_SECRET: FAKE_NAVERPAY.recurrent.clientSecret,
          SKELETON_PAYMENT_NAVERPAY_RECURRENT_CHAIN_ID: FAKE_NAVERPAY.recurrent.chainId,
          SKELETON_PAYMENT_NAVERPAY_RETURN_URL: `${fakeNaverPay.url}/return`,
          SKELETON_PAYMENT_NAVERPAY_BASE_URL: fakeNaverPay.url,
          SKELETON_PAYMENT_NAVERPAY_WINDOW_BASE_URL: fakeNaverPay.url,
        }
      : {}
    const dashboardEnv =
      fakeCloudflare && fakeGa
        ? {
            SKELETON_DASHBOARD_CLOUDFLARE_API_TOKEN: FAKE_CLOUDFLARE.apiToken,
            SKELETON_DASHBOARD_GA_CREDENTIALS: Buffer.from(fakeGa.serviceAccountJson).toString(
              'base64',
            ),
          }
        : {}
    backendEnv = {
      ...process.env,
      ...fakeConfig,
      ...dashboardEnv,
      ...tossEnv,
      ...kakaoEnv,
      ...naverEnv,
      ...paddleEnv,
      MARINA_DIRECT: '1',
      ...(native
        ? {
            E2E_NATIVE_FORWARD_PORTS: [
              fake,
              fakeToss,
              fakePaddle,
              fakeKakaoPay,
              fakeNaverPay,
              fakeCloudflare,
              fakeGa,
            ]
              .flatMap((f) => (f ? [new URL(f.url).port] : []))
              .join(' '),
          }
        : {}),
      SERVER_PORT: String(serverPort),
      DB_PORT: String(dbPort),
      S3_PORT: String(s3Port),
      MAIL_SMTP_PORT: String(smtpPort),
      MAIL_HTTP_PORT: String(mailHttpPort),
      // 개발 중인 다른 백엔드(같은 스크립트의 기본 프로젝트)와 컨테이너가 섞이지 않게 이 실행만의 이름
      E2E_COMPOSE_PROJECT: process.env.E2E_COMPOSE_PROJECT ?? `react-skeleton-e2e-${process.pid}`,
    }
    const started = spawnSync('bash', [backendScript, 'start'], {
      encoding: 'utf8',
      env: backendEnv,
      timeout: native ? 1_800_000 : 560_000, // 네이티브는 첫 빌드가 5~10분
    })
    if (started.status !== 0)
      throw new Error(`backend did not start:\n${started.stdout}\n${started.stderr}`)
    apiUrl = /^READY (\S+)$/m.exec(started.stdout)?.[1] ?? ''
    if (!apiUrl) throw new Error(`backend script printed no READY <url> line:\n${started.stdout}`)
    fakePaddle?.setBackend(apiUrl)
    // 스크립트가 올린 메일 수신기 — `MAIL smtp=… api=http://localhost:<포트>/api/v1`
    if (!mailUrl) {
      const api = /^MAIL smtp=\S+ api=(\S+)$/m.exec(started.stdout)?.[1]
      if (!api) {
        spawnSync('bash', [backendScript, 'stop'], { env: backendEnv })
        throw new Error(
          `backend script printed no "MAIL smtp=… api=…" line (its mailpit did not start?):\n${started.stdout}`,
        )
      }
      mailUrl = api.replace(/\/api\/v1\/?$/, '')
    }
  }

  // Vite 서버(rolldown)가 드물게 기동 중 교착으로 0% CPU 로 멈춘다(README "알려진 함정") — 첫 응답을 기다리다 제때 안 오면 그룹째 죽이고 새로 띄운다
  let web: ChildProcess | null = null
  let baseUrl = ''
  const killWeb = () => {
    if (web?.pid) {
      try {
        process.kill(-web.pid) // 프로세스 그룹째 — pnpm 이 낳은 서버까지
      } catch {
        // 이미 끝남
      }
    }
  }
  const WEB_ATTEMPTS = 3
  for (let attempt = 1; ; attempt++) {
    const port = await freePort()
    web = spawn(
      'pnpm',
      ['exec', 'vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
      {
        cwd: appDir,
        env: {
          ...process.env,
          API_PROXY_TARGET: apiUrl,
          ...(filesTarget ? { FILES_PROXY_TARGET: filesTarget } : {}),
          MARINA_DIRECT: '1',
        },
        stdio: 'ignore',
        detached: true,
      },
    )
    baseUrl = `http://127.0.0.1:${port}`
    fakeKakaoPay?.setApp(baseUrl)
    fakeNaverPay?.setApp(baseUrl)
    try {
      await waitFor(`${baseUrl}/`, 'web server', 30_000)
      break
    } catch (error) {
      killWeb()
      if (attempt >= WEB_ATTEMPTS) {
        if (backendScript) spawnSync('bash', [backendScript, 'stop'], { env: backendEnv })
        throw error
      }
      console.warn(`[e2e] web server not up (attempt ${attempt}/${WEB_ATTEMPTS}) — restarting`)
    }
  }

  const stopAll = () => {
    killWeb()
    void fake?.close()
    void fakeToss?.close()
    void fakePaddle?.close()
    void fakeKakaoPay?.close()
    void fakeNaverPay?.close()
    void fakeCloudflare?.close()
    void fakeGa?.close()
    if (backendScript) spawnSync('bash', [backendScript, 'stop'], { env: backendEnv })
  }

  try {
    await waitFor(`${baseUrl}/api/v1/auth/me`, 'backend through the web server proxy')
  } catch (error) {
    stopAll()
    throw error
  }

  project.provide('baseUrl', baseUrl)
  project.provide('apiUrl', apiUrl)
  project.provide('mailUrl', mailUrl)
  project.provide('fakeUrl', fake?.url ?? '')
  project.provide('fakeTossUrl', fakeToss?.url ?? '')
  project.provide('fakeKakaoPayUrl', fakeKakaoPay?.url ?? '')
  project.provide('fakeNaverPayUrl', fakeNaverPay?.url ?? '')
  project.provide('fakePaddleUrl', fakePaddle?.url ?? '')
  project.provide('fakeCloudflareUrl', fakeCloudflare?.url ?? '')
  project.provide('fakeGaUrl', fakeGa?.url ?? '')
  return stopAll
}
