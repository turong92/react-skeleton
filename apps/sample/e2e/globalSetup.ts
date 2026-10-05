import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TestProject } from 'vitest/node'

/*
 * e2e 준비 — 1) 백엔드(kotlin-skeleton 의 `scripts/sample-e2e-backend.sh start`: 새 DB · 로컬 S3 · apps/sample 기동, 준비되면 `READY <주소>` 한 줄을 찍는다)
 * 2) 이 앱의 Vite 개발 서버(빈 포트, 그 백엔드로 /api/v1 프록시) 3) 테스트에 두 주소를 준다. 끝나면 둘 다 내린다.
 *
 * 환경변수: E2E_API_URL — 이미 떠 있는 백엔드를 쓴다(기동 · 정리를 건너뜀) · SAMPLE_API_DIR — 백엔드 레포 위치(기본: 이 레포 옆 ../kotlin-skeleton)
 */
declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string
    apiUrl: string
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
  if (!apiUrl) {
    const apiDir = resolve(process.env.SAMPLE_API_DIR ?? resolve(repoRoot, '../kotlin-skeleton'))
    backendScript = resolve(apiDir, 'scripts/sample-e2e-backend.sh')
    // 빈 포트 셋(백엔드 · DB · 로컬 S3) — 개발 중인 다른 서버와 겹치지 않는다
    const [serverPort, dbPort, s3Port] = [await freePort(), await freePort(), await freePort()]
    backendEnv = {
      ...process.env,
      MARINA_DIRECT: '1',
      SERVER_PORT: String(serverPort),
      DB_PORT: String(dbPort),
      S3_PORT: String(s3Port),
    }
    const started = spawnSync('bash', [backendScript, 'start'], {
      encoding: 'utf8',
      env: backendEnv,
      timeout: 280_000,
    })
    if (started.status !== 0)
      throw new Error(`backend did not start:\n${started.stdout}\n${started.stderr}`)
    apiUrl = /^READY (\S+)$/m.exec(started.stdout)?.[1] ?? ''
    if (!apiUrl) throw new Error(`backend script printed no READY <url> line:\n${started.stdout}`)
  }

  const port = await freePort()
  const web: ChildProcess = spawn(
    'pnpm',
    ['exec', 'vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    {
      cwd: appDir,
      env: { ...process.env, API_PROXY_TARGET: apiUrl, MARINA_DIRECT: '1' },
      stdio: 'ignore',
      detached: true,
    },
  )
  const baseUrl = `http://127.0.0.1:${port}`

  const stopAll = () => {
    if (web.pid) {
      try {
        process.kill(-web.pid) // 프로세스 그룹째 — pnpm 이 낳은 서버까지
      } catch {
        // 이미 끝남
      }
    }
    if (backendScript) spawnSync('bash', [backendScript, 'stop'], { env: backendEnv })
  }

  try {
    await waitFor(`${baseUrl}/`, 'web server')
    await waitFor(`${baseUrl}/api/v1/auth/me`, 'backend through the web server proxy')
  } catch (error) {
    stopAll()
    throw error
  }

  project.provide('baseUrl', baseUrl)
  project.provide('apiUrl', apiUrl)
  return stopAll
}
