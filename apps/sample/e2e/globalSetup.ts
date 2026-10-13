import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TestProject } from 'vitest/node'
import { FAKE_LINE, FAKE_X, startFakeProviders, type FakeProviders } from './fakeProviders'
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
 * 가짜 Paddle: 가짜 토스와 함께 켠다(`E2E_FAKE_PADDLE=0` 이면 끈다) - `fakePaddle.ts` 가 서명한 웹훅을 백엔드로 쏘고(백엔드 주소는 기동 뒤 알려 준다) 백엔드의 Paddle 설정(`SKELETON_PAYMENT_PADDLE_*` · `PADDLE_*`)이 이 서버를 본다.
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
    /** 가짜 Paddle(`fakePaddle.ts`) — `E2E_FAKE_PADDLE=0` 이거나 이미 떠 있는 백엔드를 쓰면 빈 문자열 */
    fakePaddleUrl: string
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '..')
const repoRoot = resolve(appDir, '../..')

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
  let apiUrl = process.env.E2E_API_URL ?? ''
  let mailUrl = process.env.E2E_MAIL_URL ?? ''
  if (!apiUrl) {
    const apiDir = resolve(process.env.SAMPLE_API_DIR ?? resolve(repoRoot, '../kotlin-skeleton'))
    backendScript = resolve(apiDir, 'scripts/sample-e2e-backend.sh')
    // 빈 포트 셋(백엔드 · DB · 로컬 S3) — 개발 중인 다른 서버와 겹치지 않는다
    const [serverPort, dbPort, s3Port] = [await freePort(), await freePort(), await freePort()]
    const [smtpPort, mailHttpPort] = [
      Number(process.env.E2E_MAIL_SMTP_PORT) || (await freePort()),
      await freePort(),
    ]
    // 가짜 소셜 제공자는 기본으로 켠다 — 표준 e2e 한 번이 소셜 여정까지 돌게(`E2E_FAKE_PROVIDERS=0` 이면 끈다: 소셜 없는 백엔드 구성)
    if (process.env.E2E_FAKE_PROVIDERS !== '0') fake = await startFakeProviders()
    // 가짜 토스도 기본으로 켠다 — 결제 여정(결제창 → 승인 → 조회 → 환불)을 진짜 토스 없이 끝까지(`E2E_FAKE_TOSS=0` 이면 끈다: 결제 없는 백엔드 구성)
    if (process.env.E2E_FAKE_TOSS !== '0') fakeToss = await startFakeToss()
    if (process.env.E2E_FAKE_PADDLE !== '0') fakePaddle = await startFakePaddle()
    // 링크 로그인 요청은 같은 IP(::1)에서 시간당 10번(`skeleton.auth-magic-link.per-ip`, 넘으면 429)이 한도다 — 이 실행의 시나리오는 한 백엔드에 새 계정을 여럿 만들어 10번을 넘는다. e2e 백엔드에서만 올린다
    // E2E_EMAIL_REAUTH_WINDOW=PT0S: 첫 이메일 등록의 재인증 면제 창을 없앤다 — 「1시간이 지난」 제공자 재동의 길(emailReauth.e2e.ts)을 만들 수 있는 유일한 길. 표준 실행에서는 쓰지 않는다
    // 아이디 정하기 한도(`login-id.claim-limit`: 계정마다 · IP 마다 시간당 10번 - 같은 IP 에서 계정을 여럿 만드는 이 실행은 넘는다)와 실시간 중복 확인의 IP 한도(`check-per-ip`)도 e2e 백엔드에서만 올린다
    const e2eLimits = {
      'auth-magic-link': { 'per-ip': 100 },
      account: {
        'login-id': { 'claim-limit': 1000, 'check-per-ip': 5000 },
        ...(process.env.E2E_EMAIL_REAUTH_WINDOW
          ? { email: { 'first-registration-window': process.env.E2E_EMAIL_REAUTH_WINDOW } }
          : {}),
      },
    }
    // 결제 시나리오가 기다릴 수 있는 시간 안에 끝나게(값과 까닭은 `paymentE2eConfig.ts`) — 응답 제한(10초)도 같이 싣는다: 백엔드는 `reconcile.first-delay` 가 그보다 길지 않으면 기동에 실패한다(스펙 §9.2)
    const e2eSkeleton = {
      ...e2eLimits,
      ...(fakeToss || fakePaddle ? PAYMENT_E2E_SKELETON : {}),
    }
    const fakeConfig = fake
      ? {
          SPRING_APPLICATION_JSON: JSON.stringify({
            skeleton: {
              ...e2eSkeleton,
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
      : { SPRING_APPLICATION_JSON: JSON.stringify({ skeleton: e2eSkeleton }) }
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
    backendEnv = {
      ...process.env,
      ...fakeConfig,
      ...tossEnv,
      ...paddleEnv,
      MARINA_DIRECT: '1',
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
      timeout: 560_000,
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
        env: { ...process.env, API_PROXY_TARGET: apiUrl, MARINA_DIRECT: '1' },
        stdio: 'ignore',
        detached: true,
      },
    )
    baseUrl = `http://127.0.0.1:${port}`
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
  project.provide('fakePaddleUrl', fakePaddle?.url ?? '')
  return stopAll
}
