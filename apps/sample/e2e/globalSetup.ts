import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TestProject } from 'vitest/node'

/*
 * e2e 준비 — 1) 백엔드(kotlin-skeleton 의 `scripts/sample-e2e-backend.sh start`: 새 DB · 로컬 S3 · apps/sample 기동, 준비되면 `READY <주소>` 한 줄을 찍는다)
 * 2) 이 앱의 Vite 개발 서버(빈 포트, 그 백엔드로 /api/v1 프록시) 3) 테스트에 두 주소를 준다. 끝나면 둘 다 내린다.
 *
 * 메일: 백엔드(local 프로필)는 SMTP `localhost:${MAIL_SMTP_PORT:1025}` 로 보낸다 — 이 준비 단계가 mailpit 컨테이너를 빈 포트로 띄워 그 포트를 알려 주고(`MAIL_SMTP_PORT`), 테스트는 그 HTTP API 에서 링크를 읽는다.
 *   (백엔드의 `sample-e2e-backend.sh` 는 메일 컨테이너를 올리지 않는다.) E2E_MAIL_URL 을 주면 이미 떠 있는 캐처를 쓴다.
 *
 * 환경변수: E2E_API_URL — 이미 떠 있는 백엔드를 쓴다(기동 · 정리를 건너뜀) · SAMPLE_API_DIR — 백엔드 레포 위치(기본: 이 레포 옆 ../kotlin-skeleton)
 */
declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string
    apiUrl: string
    /** 메일 캐처(mailpit)의 HTTP API 주소 — 백엔드가 보낸 메일의 링크를 읽는다 */
    mailUrl: string
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
  let apiUrl = process.env.E2E_API_URL ?? ''
  let mailUrl = process.env.E2E_MAIL_URL ?? ''
  let mailContainer: string | null = null
  if (!apiUrl) {
    const apiDir = resolve(process.env.SAMPLE_API_DIR ?? resolve(repoRoot, '../kotlin-skeleton'))
    backendScript = resolve(apiDir, 'scripts/sample-e2e-backend.sh')
    // 빈 포트 셋(백엔드 · DB · 로컬 S3) — 개발 중인 다른 서버와 겹치지 않는다
    const [serverPort, dbPort, s3Port] = [await freePort(), await freePort(), await freePort()]
    const [smtpPort, mailHttpPort] = [await freePort(), await freePort()]
    if (!mailUrl) {
      const run = spawnSync(
        'docker',
        [
          'run',
          '-d',
          '--rm',
          '-p',
          `127.0.0.1:${smtpPort}:1025`,
          '-p',
          `127.0.0.1:${mailHttpPort}:8025`,
          'axllent/mailpit:v1.27',
        ],
        { encoding: 'utf8' },
      )
      if (run.status !== 0) throw new Error(`mailpit did not start:\n${run.stdout}\n${run.stderr}`)
      mailContainer = run.stdout.trim()
      mailUrl = `http://127.0.0.1:${mailHttpPort}`
    }
    backendEnv = {
      ...process.env,
      MARINA_DIRECT: '1',
      SERVER_PORT: String(serverPort),
      DB_PORT: String(dbPort),
      S3_PORT: String(s3Port),
      MAIL_SMTP_PORT: String(smtpPort),
    }
    const started = spawnSync('bash', [backendScript, 'start'], {
      encoding: 'utf8',
      env: backendEnv,
      timeout: 280_000,
    })
    if (started.status !== 0) {
      if (mailContainer) spawnSync('docker', ['rm', '-f', mailContainer])
      throw new Error(`backend did not start:\n${started.stdout}\n${started.stderr}`)
    }
    apiUrl = /^READY (\S+)$/m.exec(started.stdout)?.[1] ?? ''
    if (!apiUrl) throw new Error(`backend script printed no READY <url> line:\n${started.stdout}`)
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
        if (mailContainer) spawnSync('docker', ['rm', '-f', mailContainer])
        throw error
      }
      console.warn(`[e2e] web server not up (attempt ${attempt}/${WEB_ATTEMPTS}) — restarting`)
    }
  }

  const stopAll = () => {
    killWeb()
    if (backendScript) spawnSync('bash', [backendScript, 'stop'], { env: backendEnv })
    if (mailContainer) spawnSync('docker', ['rm', '-f', mailContainer])
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
  return stopAll
}
