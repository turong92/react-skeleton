import { spawn, type ChildProcess } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { APP_NAME } from '../src/appName.ts'

/*
 * 빌드한 서버를 진짜로 띄운다: `vite build`(클라이언트 + 서버 번들)를 임시 폴더에 하고, 그 결과만 node_modules 가 없는 다른 폴더로 복사해
 * `node server/main.ts` 를 빈 포트로 실행한 뒤, JS 없는 평범한 HTTP 클라이언트(fetch)로 요청한다.
 * 백엔드는 이 파일이 띄운 가짜 서버다(정상 · 응답 없음 · 연결 거부). 끝나면 어떤 경우에도 자식 프로세스를 죽이고 임시 폴더를 지운다 —
 * 모든 대기에 시간 제한이 있다(rolldown 교착 · 서버가 안 뜸 · 응답이 안 옴으로 테스트가 멈추지 않는다).
 */
const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const BUILD_TIMEOUT_MS = 150_000
const START_TIMEOUT_MS = 15_000
const REQUEST_TIMEOUT_MS = 8_000

const children = new Set<ChildProcess>()
const killAll = () => children.forEach((child) => child.kill('SIGKILL'))
process.once('exit', killAll)

function run(command: string, args: string[], cwd: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // vitest 가 NODE_ENV=test 를 물려주면 vite 가 개발용 JSX 로 빌드한다 — 실제 `pnpm build` 와 같게 production 으로
    const env = { ...process.env, NODE_ENV: 'production' }
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    children.add(child)
    let output = ''
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(
        new Error(
          `${args.join(' ')} did not finish in ${timeoutMs}ms (rolldown deadlock? rerun)\n${output.slice(-800)}`,
        ),
      )
    }, timeoutMs)
    child.on('exit', (code) => {
      clearTimeout(timer)
      children.delete(child)
      if (code === 0) resolve()
      else reject(new Error(`${args.join(' ')} exited with ${code}\n${output.slice(-1500)}`))
    })
  })
}

type Backend = { port: number; mode: 'ok' | 'hang'; hits: number; server: Server }
async function startBackend(): Promise<Backend> {
  const backend = { mode: 'ok', hits: 0 } as Backend
  backend.server = createServer((req, res) => {
    if (req.url?.startsWith('/api/v1/hello')) backend.hits += 1
    if (backend.mode === 'hang') return // 응답하지 않는다 — 서버 렌더의 시간 제한이 끊어야 한다
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        value: { message: 'hello from the stub backend', timestamp: '2026-01-01T00:00:00Z' },
        meta: { timestamp: 't' },
      }),
    )
  })
  await new Promise<void>((ready) => backend.server.listen(0, '127.0.0.1', ready))
  backend.port = (backend.server.address() as AddressInfo).port
  return backend
}

/** 아무도 듣지 않는 포트 — 연결 거부 */
async function closedPort(): Promise<number> {
  const probe = createNetServer()
  await new Promise<void>((ready) => probe.listen(0, '127.0.0.1', ready))
  const { port } = probe.address() as AddressInfo
  await new Promise((done) => probe.close(done))
  return port
}

type Running = { child: ChildProcess; base: string; stop: () => Promise<number | null> }
function startServer(appDir: string, apiPort: number): Promise<Running> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(appDir, 'server', 'main.ts')], {
      cwd: appDir,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '0',
        API_BASE_URL: `http://127.0.0.1:${apiPort}/api/v1`,
        SSR_API_TIMEOUT_MS: '400',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    children.add(child)
    let output = ''
    const stop = () =>
      new Promise<number | null>((done) => {
        if (child.exitCode !== null) return done(child.exitCode)
        const hard = setTimeout(() => child.kill('SIGKILL'), 4000)
        child.once('exit', (code) => {
          clearTimeout(hard)
          children.delete(child)
          done(code)
        })
        child.kill('SIGTERM')
      })
    const timer = setTimeout(() => {
      void stop()
      reject(new Error(`server did not start in ${START_TIMEOUT_MS}ms:\n${output}`))
    }, START_TIMEOUT_MS)
    const onData = (chunk: Buffer) => {
      output += chunk
      const match = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(output)
      if (match) {
        clearTimeout(timer)
        resolve({ child, base: match[1], stop })
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', (chunk) => (output += chunk))
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`server exited early (${code}):\n${output}`))
    })
  })
}

const get = (base: string, path: string) =>
  fetch(`${base}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), redirect: 'manual' })

let work = ''
let appDir = ''
let backend: Backend
let live: Running
let orphan: Running

beforeAll(
  async () => {
    work = mkdtempSync(join(tmpdir(), 'ssr-it-'))
    const vite = join(
      dirname(createRequire(import.meta.url).resolve('vite/package.json')),
      'bin',
      'vite.js',
    )
    const built = join(work, 'built')
    await run(
      process.execPath,
      [vite, 'build', '--outDir', join(built, 'client'), '--emptyOutDir'],
      APP_ROOT,
      BUILD_TIMEOUT_MS,
    )
    await run(
      process.execPath,
      [
        vite,
        'build',
        '--ssr',
        'src/entry-server.tsx',
        '--outDir',
        join(built, 'server'),
        '--emptyOutDir',
      ],
      APP_ROOT,
      BUILD_TIMEOUT_MS,
    )
    // 서버가 하는 일만 — node_modules 가 없는 곳으로 복사해, 프로덕션 실행에 의존 설치가 필요 없음을 함께 확인한다
    appDir = join(work, 'app')
    cpSync(join(APP_ROOT, 'server'), join(appDir, 'server'), {
      recursive: true,
      filter: (path) => !/\.test\.ts$/.test(path),
    })
    cpSync(built, join(appDir, 'dist'), { recursive: true })
    backend = await startBackend()
    live = await startServer(appDir, backend.port)
    orphan = await startServer(appDir, await closedPort())
  },
  BUILD_TIMEOUT_MS * 2 + 60_000,
)

afterAll(async () => {
  await Promise.allSettled([live?.stop(), orphan?.stop()])
  backend?.server.closeAllConnections()
  await new Promise((done) => backend?.server.close(done) ?? done(undefined))
  killAll()
  if (work) rmSync(work, { recursive: true, force: true })
}, 30_000)

describe('the built server, asked by a client that runs no JavaScript', () => {
  it('GET / is 200 and the HTML already holds the page content, the backend answer, title, lang and the theme script', async () => {
    const hitsBefore = backend.hits
    const response = await get(live.base, '/')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html).toContain('<html lang="ko">')
    expect(html).toContain(`<title>홈 · ${APP_NAME}</title>`)
    expect(html).toContain('<meta name="description" content="')
    expect(html).toMatch(/<div id="root"><div/) // 비어 있지 않다 — 서버가 그렸다
    expect(html).toContain('백엔드 연결')
    expect(html).toContain('hello from the stub backend')
    expect(html).not.toContain('불러오는 중')
    // 첫 칠 전 테마 스크립트가 <head> 안, 앱 마크업보다 앞에 있다
    const head = html.slice(0, html.indexOf('</head>'))
    expect(head).toMatch(/<script>[^<]*localStorage\.getItem\("theme"\)/)
    expect(head).toContain('id="__SSR_STATE__"')
    expect(backend.hits - hitsBefore).toBe(1)
  }, 20_000)

  it('the scripts and styles the page links to resolve with the right content types', async () => {
    const html = await (await get(live.base, '/')).text()
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
    expect(assets.some((path) => path.endsWith('.js'))).toBe(true)
    expect(assets.some((path) => path.endsWith('.css'))).toBe(true)
    for (const path of assets) {
      const response = await get(live.base, path)
      expect(response.status, path).toBe(200)
      expect((await response.text()).length, path).toBeGreaterThan(0)
      expect(response.headers.get('content-type'), path).toMatch(
        path.endsWith('.css') ? /text\/css/ : /text\/javascript/,
      )
    }
    expect((await get(live.base, '/favicon.svg')).status).toBe(200)
  }, 20_000)

  it('GET /account is 200 with a neutral placeholder (the token is in the browser), noindex', async () => {
    const html = await (await get(live.base, '/account')).text()
    expect(html).toContain('확인 중')
    expect(html).not.toContain('로그인됨')
    expect(html).toContain(`<title>계정 · ${APP_NAME}</title>`)
    expect(html).toContain('noindex')
  }, 20_000)

  it('an unknown path is a real 404 with the not-found page; a missing asset is a plain 404', async () => {
    const page = await get(live.base, '/no/such/page')
    expect(page.status).toBe(404)
    expect(await page.text()).toContain('404 — Not Found')
    const asset = await get(live.base, '/assets/nope-123.js')
    expect(asset.status).toBe(404)
    expect(asset.headers.get('content-type')).toContain('text/plain')
  }, 20_000)

  it('a backend that never answers is cut off by the server-side timeout: still 200, fallback state, quickly', async () => {
    backend.mode = 'hang'
    try {
      const started = Date.now()
      const response = await get(live.base, '/')
      const html = await response.text()
      expect(Date.now() - started).toBeLessThan(3000)
      expect(response.status).toBe(200)
      expect(html).toContain('불러오는 중')
      expect(html).not.toContain('hello from the stub backend')
    } finally {
      backend.mode = 'ok'
    }
  }, 20_000)

  it('a backend that is down (connection refused) still gives 200 with the fallback state', async () => {
    const response = await get(orphan.base, '/')
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('불러오는 중')
    expect(html).toContain('백엔드 연결')
  }, 20_000)

  it('shuts down cleanly on SIGTERM', async () => {
    expect(await orphan.stop()).toBe(0)
  }, 20_000)
})
