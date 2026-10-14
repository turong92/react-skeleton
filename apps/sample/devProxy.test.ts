import { createServer as createHttpServer, request, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

/*
 * 개발 서버(Vite) → 백엔드 프록시. 한 백엔드가 요청 Host 로 프로젝트를 고르므로, 브라우저가 쓴 `<이름>.localhost` 가
 * 그대로 백엔드에 닿아야 한다. 실제 Vite 서버와 Host 를 기록하는 가짜 백엔드로 잰다.
 */
const closers: Array<() => Promise<unknown>> = []
afterEach(async () => {
  for (const close of closers.splice(0)) await close()
})

async function fakeBackend() {
  const seen: IncomingHttpHeaders[] = []
  const server = createHttpServer((req, res) => {
    seen.push(req.headers)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  closers.push(() => new Promise((resolve) => server.close(resolve)))
  return { port: (server.address() as AddressInfo).port, seen }
}

async function devServer(backendPort: number): Promise<{ vite: ViteDevServer; port: number }> {
  process.env.API_PROXY_TARGET = `http://127.0.0.1:${backendPort}`
  const vite = await createServer({
    configFile: new URL('./vite.config.ts', import.meta.url).pathname,
    logLevel: 'silent',
    server: { port: 0, host: '127.0.0.1' },
  })
  await vite.listen()
  closers.push(() => vite.close())
  return { vite, port: (vite.httpServer!.address() as AddressInfo).port }
}

function get(port: number, path: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers: { host } }, (res) => {
      res.resume()
      res.on('end', () => resolve(res.statusCode ?? 0))
    })
    req.on('error', reject)
    req.end()
  })
}

describe('dev proxy to the backend', () => {
  it('hands the host the browser used (a.localhost:PORT) to the backend, not the backend address', async () => {
    const backend = await fakeBackend()
    const { port } = await devServer(backend.port)
    expect(await get(port, '/api/v1/ping', `a.localhost:${port}`)).toBe(200)
    expect(backend.seen[0]?.host).toBe(`a.localhost:${port}`)
    expect(backend.seen[0]?.['x-forwarded-host']).toBe(`a.localhost:${port}`)
  })

  it('keeps today’s behaviour for localhost and other hosts: the backend sees its own address', async () => {
    const backend = await fakeBackend()
    const { port } = await devServer(backend.port)
    expect(await get(port, '/api/v1/ping', `localhost:${port}`)).toBe(200)
    expect(await get(port, '/api/v1/ping', `127.0.0.1:${port}`)).toBe(200)
    expect(backend.seen.map((h) => h.host)).toEqual([
      `127.0.0.1:${backend.port}`,
      `127.0.0.1:${backend.port}`,
    ])
    expect(backend.seen.every((h) => h['x-forwarded-host'] === undefined)).toBe(true)
  })

  it('still refuses hosts that are neither localhost nor *.localhost', async () => {
    const backend = await fakeBackend()
    const { port } = await devServer(backend.port)
    expect(await get(port, '/api/v1/ping', 'evil.example.com')).toBe(403)
    expect(backend.seen).toEqual([])
  })
})
