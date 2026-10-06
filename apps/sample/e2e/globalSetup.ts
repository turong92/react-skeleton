import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TestProject } from 'vitest/node'
import { FAKE_LINE, FAKE_X, startFakeProviders, type FakeProviders } from './fakeProviders'

/*
 * e2e 준비 — 1) 백엔드(kotlin-skeleton 의 `scripts/sample-e2e-backend.sh start`: 새 DB · 로컬 S3 · apps/sample 기동, 준비되면 `READY <주소>` 한 줄을 찍는다)
 * 2) 이 앱의 Vite 개발 서버(빈 포트, 그 백엔드로 /api/v1 프록시) 3) 테스트에 두 주소를 준다. 끝나면 둘 다 내린다.
 *
 * 메일: 백엔드의 `sample-e2e-backend.sh` 가 mailpit(compose `mail` 프로필)도 함께 올리고 `MAIL smtp=localhost:<포트> api=<주소>` 한 줄을 찍는다 —
 *   이 준비 단계는 빈 포트(`MAIL_SMTP_PORT` · `MAIL_HTTP_PORT`)를 넘겨 그 줄의 api 주소를 테스트에 주고, 테스트는 그 HTTP API 에서 링크를 읽는다(자체 캐처를 띄우지 않는다).
 *   E2E_MAIL_URL 을 주면 이미 떠 있는 캐처를 쓴다(그때는 백엔드의 메일 포트를 E2E_MAIL_SMTP_PORT 로 맞춘다).
 *
 * 가짜 소셜 제공자: `E2E_FAKE_PROVIDERS=1` 이면 백엔드를 올리기 전에 가짜 LINE · X 를 띄우고 그 주소로 백엔드의 LINE · X 설정(`SPRING_APPLICATION_JSON`)을 덮는다 —
 *   소셜 백엔드(`feat/social-oidc-x`)용. 약관 재동의 필터를 시험하려면 `SKELETON_LEGAL_RECONSENT_ENABLED=true`(로컬 프로필은 꺼 둔다).
 *
 * 환경변수: E2E_API_URL — 이미 떠 있는 백엔드를 쓴다(기동 · 정리를 건너뜀) · SAMPLE_API_DIR — 백엔드 레포 위치(기본: 이 레포 옆 ../kotlin-skeleton)
 */
declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string
    apiUrl: string
    /** 메일 캐처(mailpit)의 HTTP API 주소 — 백엔드가 보낸 메일의 링크를 읽는다 */
    mailUrl: string
    /** 가짜 LINE · X(`fakeProviders.ts`) — `E2E_FAKE_PROVIDERS=1` 일 때만, 아니면 빈 문자열 */
    fakeUrl: string
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
    if (process.env.E2E_FAKE_PROVIDERS === '1') fake = await startFakeProviders()
    const fakeConfig = fake
      ? {
          SPRING_APPLICATION_JSON: JSON.stringify({
            skeleton: {
              'auth-social-oidc': {
                providers: {
                  line: {
                    'client-id': FAKE_LINE.clientId,
                    'client-secret': FAKE_LINE.clientSecret,
                    scopes: ['openid', 'profile', 'email'],
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
      : {}
    backendEnv = {
      ...process.env,
      ...fakeConfig,
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
  return stopAll
}
