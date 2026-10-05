import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import type { Render } from './contract.ts'

export type HandlerOptions = {
  /** HTML 틀 — `<!--app-head-->` · `<!--app-html-->` 자리를 가진다(개발에서는 Vite 가 변환한 것, 프로덕션에서는 `dist/client/index.html`) */
  template: (url: string) => string | Promise<string>
  render: Render
  /** 프로덕션: `vite build` 가 만든 `dist/client`. 개발에서는 Vite 미들웨어가 파일을 내주므로 없다 */
  staticDir?: string
  /** `<html lang>` — 템플릿의 값을 바꾼다(없으면 템플릿 그대로) */
  lang?: string
  onError?: (error: unknown, url: string) => void
}

const TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const SECURITY = { 'x-content-type-options': 'nosniff' }

function plain(
  res: ServerResponse,
  status: number,
  text: string,
  extra: Record<string, string> = {},
) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...SECURITY, ...extra })
  res.end(text)
}

/** `$&` 같은 패턴을 해석하지 않도록 함수로 바꾼다 — 렌더 결과에는 어떤 글자든 들어 있을 수 있다 */
function fill(
  template: string,
  { head, html, lang }: { head: string; html: string; lang?: string },
) {
  const filled = template
    .replace('<!--app-head-->', () => head)
    .replace('<!--app-html-->', () => html)
  return lang ? filled.replace(/<html lang="[^"]*"/, () => `<html lang="${lang}"`) : filled
}

/** 빌드한 클라이언트 파일을 내준다. 처리했으면 true. 폴더 밖 · 템플릿 자신은 내주지 않는다 */
async function serveStatic(
  root: string,
  pathname: string,
  method: string,
  res: ServerResponse,
): Promise<boolean> {
  const decoded = decodeURIComponent(pathname)
  if (decoded.includes('\0')) return false
  const relative = normalize(decoded)
  const file = join(root, relative)
  if (!file.startsWith(root + sep) || relative === `${sep}index.html`) return false
  const info = await stat(file).catch(() => null)
  if (!info?.isFile()) return false
  const hashed = relative.startsWith(`${sep}assets${sep}`)
  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': info.size,
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    ...SECURITY,
  })
  if (method === 'HEAD') res.end()
  else createReadStream(file).pipe(res)
  return true
}

/** 요청 하나를 받아 파일이면 파일, 아니면 서버 렌더 결과를 보낸다. 던지지 않는다 */
export function createHandler({ template, render, staticDir, lang, onError }: HandlerOptions) {
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET'
    if (method !== 'GET' && method !== 'HEAD')
      return plain(res, 405, 'Method Not Allowed', { allow: 'GET, HEAD' })
    let url: URL
    try {
      url = new URL(req.url ?? '/', 'http://localhost')
      decodeURIComponent(url.pathname)
    } catch {
      return plain(res, 400, 'Bad Request')
    }
    const target = `${url.pathname}${url.search}`
    try {
      if (staticDir) {
        if (await serveStatic(staticDir, url.pathname, method, res)) return
        // 해시 파일이 없다 — HTML 404 페이지가 아니라 진짜 404(브라우저가 스크립트 자리에 HTML 을 받아 헷갈리지 않게)
        if (url.pathname.startsWith('/assets/')) return plain(res, 404, 'Not Found')
      }
      const result = await render(target)
      const body = fill(await template(target), { head: result.head, html: result.html, lang })
      res.writeHead(result.status, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': Buffer.byteLength(body),
        'cache-control': 'no-cache',
        ...SECURITY,
      })
      res.end(method === 'HEAD' ? undefined : body)
    } catch (error) {
      onError?.(error, target)
      if (!res.headersSent) plain(res, 500, 'Internal Server Error')
      else res.end()
    }
  }
}
