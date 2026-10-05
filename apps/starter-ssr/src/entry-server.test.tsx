import {
  createApiClient,
  type ApiClient,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import { APP_NAME } from './appName'
import { render } from './entry-server'
import { SSR_STATE_ID } from './ssr/head'

const hello =
  (message: string): AxiosAdapter =>
  async (config: InternalAxiosRequestConfig) => ({
    config,
    data: { value: { message, timestamp: '2026-06-12T00:00:00Z' }, meta: { timestamp: 't' } },
    headers: {},
    status: 200,
    statusText: 'OK',
  })
const down: AxiosAdapter = async () => {
  throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8080'), { code: 'ECONNREFUSED' })
}
const backend = (adapter: AxiosAdapter) =>
  createApiClient({ baseUrl: 'http://backend/api/v1', timeoutMs: 100, adapter })

const stateOf = (head: string) => {
  const match = new RegExp(
    `<script type="application/json" id="${SSR_STATE_ID}">(.*?)</script>`,
    's',
  ).exec(head)
  return JSON.parse(match![1]) as { queries: { queryKey: unknown[]; state: { data: unknown } }[] }
}

describe('render("/") — the home page with the hello example, rendered on the server', () => {
  it('is 200 and already contains the backend answer (no spinner), the title and the description', async () => {
    const result = await render('/', { api: backend(hello('hello from the backend')) })
    expect(result.status).toBe(200)
    expect(result.html).toContain('hello from the backend')
    expect(result.html).toContain('GET /hello')
    expect(result.html).not.toContain('불러오는 중')
    expect(result.head).toContain(`<title>홈 · ${APP_NAME}</title>`)
    expect(result.head).toContain('<meta name="description" content="')
    expect(result.head).not.toContain('noindex')
  })

  it('hands the fetched data to the browser as dehydrated TanStack Query state (so the client does not refetch)', async () => {
    const { head } = await render('/', { api: backend(hello('from state')) })
    const queries = stateOf(head).queries
    expect(queries).toHaveLength(1)
    expect(queries[0].queryKey).toEqual(['hello'])
    expect(queries[0].state.data).toEqual({
      message: 'from state',
      timestamp: '2026-06-12T00:00:00Z',
    })
  })

  it('a backend that is down still gives 200 with the fallback state: a spinner and an empty cache (the browser retries)', async () => {
    const result = await render('/', { api: backend(down) })
    expect(result.status).toBe(200)
    expect(result.html).toContain('불러오는 중')
    expect(result.html).not.toContain('호출에 실패했습니다')
    expect(stateOf(result.head).queries).toEqual([])
  })

  it('a backend that never answers is cut off by the server-side timeout — the page is still rendered', async () => {
    const hung = { value: () => new Promise(() => undefined) } as unknown as Pick<
      ApiClient,
      'value'
    >
    const started = Date.now()
    const result = await render('/', { api: hung, prefetchTimeoutMs: 30 })
    expect(Date.now() - started).toBeLessThan(1000)
    expect(result.status).toBe(200)
    expect(result.html).toContain('불러오는 중')
  })

  it('cannot be broken out of by backend text: script closers in the data stay inside the JSON, markup is escaped', async () => {
    const evil = '</script><script>alert(1)</script><img src=x onerror=alert(2)>'
    const { html, head } = await render('/', { api: backend(hello(evil)) })
    expect(head).not.toContain('</script><script>')
    expect(html).not.toContain('<img src=x')
    expect(stateOf(head).queries[0].state.data).toMatchObject({ message: evil })
  })

  it('ignores the query string for routing and handles an absolute-looking path safely', async () => {
    expect((await render('/?utm=1', { api: backend(hello('q')) })).status).toBe(200)
    expect((await render('//evil.example/x', { api: backend(hello('q')) })).status).toBe(404)
  })
})

describe('render("/account") — a protected page on the server', () => {
  it('is 200 with a neutral placeholder: no account content, no redirect, no backend call (the token lives in the browser)', async () => {
    const api = { value: vi.fn() } as unknown as Pick<ApiClient, 'value'>
    const result = await render('/account', { api })
    expect(result.status).toBe(200)
    expect(result.html).toContain('확인 중')
    expect(result.html).not.toContain('로그인됨')
    expect(result.html).not.toContain('<a href="/login"')
    expect(api.value).not.toHaveBeenCalled()
    expect(result.head).toContain(`<title>계정 · ${APP_NAME}</title>`)
    expect(result.head).toContain('<meta name="robots" content="noindex" />')
  })
})

describe('render of an unknown path', () => {
  it('is 404 with the not-found page, its own title and noindex — and fetches nothing', async () => {
    const api = { value: vi.fn() } as unknown as Pick<ApiClient, 'value'>
    const result = await render('/no/such/page', { api })
    expect(result.status).toBe(404)
    expect(result.html).toContain('404 — Not Found')
    expect(result.head).toContain(`<title>404 — 찾을 수 없음 · ${APP_NAME}</title>`)
    expect(result.head).toContain('noindex')
    expect(api.value).not.toHaveBeenCalled()
  })

  it('/login is an ordinary 200 page', async () => {
    const result = await render('/login', { api: backend(down) })
    expect(result.status).toBe(200)
    expect(result.html).toContain('로그인')
    expect(result.head).toContain(`<title>로그인 · ${APP_NAME}</title>`)
  })
})
