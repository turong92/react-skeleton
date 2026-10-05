import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, request, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Render, RenderResult } from './contract.ts'
import { createHandler } from './handler.ts'

const TEMPLATE = `<!doctype html><html lang="ko"><head><!--app-head--></head><body><div id="root"><!--app-html--></div></body></html>`

const servers: Server[] = []
const dirs: string[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done))))
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function start(options: Partial<Parameters<typeof createHandler>[0]> = {}) {
  const render: Render =
    options.render ??
    (async (url) => ({
      status: url.startsWith('/missing') ? 404 : 200,
      html: `<p>page ${url}</p>`,
      head: '<title>t</title>',
      title: 't',
    }))
  const handler = createHandler({ template: () => TEMPLATE, render, ...options })
  const server = createServer((req, res) => void handler(req, res))
  servers.push(server)
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

function staticDir(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'ssr-static-'))
  dirs.push(dir)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  return dir
}

describe('the document', () => {
  it('fills the template: head and app markup in their places, the render status as the HTTP status, html content type', async () => {
    const base = await start()
    const ok = await fetch(`${base}/?a=1`)
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(ok.headers.get('cache-control')).toBe('no-cache')
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff')
    const body = await ok.text()
    expect(body).toContain('<head><title>t</title></head>')
    expect(body).toContain('<div id="root"><p>page /?a=1</p></div>')
    expect((await fetch(`${base}/missing/page`)).status).toBe(404)
  })

  it('does not interpret $ patterns that appear in the rendered text', async () => {
    const base = await start({
      render: async () => ({ status: 200, html: 'price $& $1 $$', head: '', title: 't' }),
    })
    expect(await (await fetch(base)).text()).toContain('<div id="root">price $& $1 $$</div>')
  })

  it('sets the html lang from the option', async () => {
    const base = await start({ lang: 'en' })
    expect(await (await fetch(base)).text()).toContain('<html lang="en">')
  })

  it('answers HEAD with the headers only and other methods with 405', async () => {
    const base = await start()
    const head = await fetch(base, { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
    const post = await fetch(base, { method: 'POST', body: 'x' })
    expect(post.status).toBe(405)
    expect(post.headers.get('allow')).toBe('GET, HEAD')
  })

  it('a render that throws becomes a plain 500 page without the error text, and is reported', async () => {
    const onError = vi.fn()
    const base = await start({
      render: async () => {
        throw new Error('secret stack detail')
      },
      onError,
    })
    const response = await fetch(base)
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('secret stack detail')
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('refuses a malformed url with 400 instead of crashing', async () => {
    const base = await start()
    const { status } = await fetch(`${base}/%E0%A4%A`)
    expect(status).toBe(400)
  })
})

describe('built client files', () => {
  it('serves hashed assets with a long immutable cache and the right content type', async () => {
    const dir = staticDir({
      'assets/app-abc.js': 'console.log(1)',
      'assets/app-abc.css': 'a{}',
      'favicon.svg': '<svg/>',
    })
    const base = await start({ staticDir: dir })
    const js = await fetch(`${base}/assets/app-abc.js`)
    expect(js.status).toBe(200)
    expect(js.headers.get('content-type')).toContain('text/javascript')
    expect(js.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(await js.text()).toBe('console.log(1)')
    expect((await fetch(`${base}/assets/app-abc.css`)).headers.get('content-type')).toContain(
      'text/css',
    )
    const icon = await fetch(`${base}/favicon.svg`)
    expect(icon.headers.get('content-type')).toBe('image/svg+xml')
    expect(icon.headers.get('cache-control')).toBe('public, max-age=3600')
  })

  it('a missing asset is a plain 404, not the HTML not-found page; any other path goes to the server render', async () => {
    const base = await start({ staticDir: staticDir({}) })
    const asset = await fetch(`${base}/assets/gone.js`)
    expect(asset.status).toBe(404)
    expect(asset.headers.get('content-type')).toContain('text/plain')
    expect(await (await fetch(`${base}/somewhere`)).text()).toContain('page /somewhere')
  })

  it('never serves the template file itself and never leaves the folder', async () => {
    const dir = staticDir({ 'index.html': 'RAW TEMPLATE' })
    const outside = join(dir, '..', 'ssr-secret.txt')
    writeFileSync(outside, 'top secret')
    dirs.push(outside)
    const base = await start({ staticDir: dir })
    expect(await (await fetch(`${base}/index.html`)).text()).not.toContain('RAW TEMPLATE')
    // fetch 는 `..` 를 보내기 전에 정리해 버린다 — 정리되지 않은 그대로의 경로를 보내려고 http.request 를 쓴다
    const raw = (path: string) =>
      new Promise<string>((resolve, reject) => {
        const { port } = new URL(base)
        request({ host: '127.0.0.1', port, path }, (response) => {
          let text = ''
          response.on('data', (chunk) => (text += chunk))
          response.on('end', () => resolve(text))
        })
          .on('error', reject)
          .end()
      })
    for (const path of [
      '/../ssr-secret.txt',
      '/assets/../../ssr-secret.txt',
      '/assets/..%2f..%2fssr-secret.txt',
      '/%2e%2e/ssr-secret.txt',
    ])
      expect(await raw(path), path).not.toContain('top secret')
  })
})

describe('RenderResult shape', () => {
  it('is what the handler consumes', () => {
    const result: RenderResult = { status: 200, html: '', head: '', title: '' }
    expect(Object.keys(result).sort()).toEqual(['head', 'html', 'status', 'title'])
  })
})
