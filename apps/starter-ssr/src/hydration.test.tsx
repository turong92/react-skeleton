import { createApiClient, type AxiosAdapter } from '@skeleton/api-client'
import {
  AuthProvider,
  createAuthSession,
  createTokenStore,
  type TokenStorage,
} from '@skeleton/auth'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ApiProvider } from './api/ApiProvider'
import { AppRoutes } from './app/AppRoutes'
import { createClientApp } from './app/createClientApp'
import { createQueryClient } from './app/createQueryClient'
import { createAuth, createDeferredTokens } from './auth/createAuth'
import { render } from './entry-server'
import { SSR_STATE_ID } from './ssr/head'

/*
 * 하이드레이션은 「브라우저의 첫 그림이 서버가 보낸 HTML 과 같아야」 한다. DOM 라이브러리 없이 잴 수 있는 만큼:
 * 서버가 그린 HTML 과, 브라우저 진입점이 쓰는 같은 트리(`createClientApp`)를 「브라우저처럼」(저장소에 토큰이 있고, 서버가 보낸 상태를
 * 이어받은 채) 그린 HTML 이 글자 하나까지 같은지. 같지 않으면 React 가 하이드레이션 경고를 내고 서버 HTML 을 버린다.
 * (실제 브라우저에서의 확인은 README 의 「눈으로 확인」 — 콘솔에 하이드레이션 경고가 없어야 한다)
 */
const hello: AxiosAdapter = async (config) => ({
  config,
  data: { value: { message: 'hello over the wire', timestamp: 't' }, meta: { timestamp: 't' } },
  headers: {},
  status: 200,
  statusText: 'OK',
})
const backend = createApiClient({
  baseUrl: 'http://backend/api/v1',
  timeoutMs: 100,
  adapter: hello,
})

// 브라우저 저장소에는 로그인한 토큰이 들어 있다 — 서버는 이것을 모른다
const browserStorage: TokenStorage = {
  getItem: () => 'a.jwt.token',
  setItem: () => undefined,
  removeItem: () => undefined,
}

function stateIn(head: string): unknown {
  const match = new RegExp(`id="${SSR_STATE_ID}">(.*?)</script>`, 's').exec(head)
  return JSON.parse(match![1])
}

const urls = ['/', '/login', '/account', '/no/such/page']

describe.each(urls)('hydration of %s', (url) => {
  it('the first browser render equals the server HTML (token in storage, state from the server)', async () => {
    const server = await render(url, { api: backend })
    const client = renderToString(
      createClientApp({
        env: {},
        storage: browserStorage,
        state: stateIn(server.head),
        Router: ({ children }: { children: ReactNode }) => (
          <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
        ),
      }),
    )
    expect(client).toBe(server.html)
  })
})

describe('the check can fail (it is not vacuous)', () => {
  const unused = async () => {
    throw new Error('unused')
  }
  const api = {
    login: unused,
    socialLogin: unused,
    me: unused,
    refresh: unused,
    logout: unused,
    magicLinkRequest: unused,
    methods: async () => {
      throw new Error('unused')
    },
    magicLinkRedeem: unused,
  }

  it('reading the stored token while creating the session gives a different first render — the logout button appears', async () => {
    const server = await render('/', { api: backend })
    const store = createTokenStore({ storage: browserStorage }) // 읽기를 미루지 않는 순진한 방식
    const eager = renderToString(
      <QueryClientProvider client={createQueryClient()}>
        <ApiProvider client={backend}>
          <AuthProvider session={createAuthSession({ api, store })}>
            <MemoryRouter initialEntries={['/']}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </ApiProvider>
      </QueryClientProvider>,
    )
    expect(eager).toContain('로그아웃')
    expect(server.html).not.toContain('로그아웃')
    // 같은 앱 트리에 지연 복원 세션을 쓰면 로그아웃 버튼이 없다
    const deferred = createAuth({ api, tokens: createDeferredTokens({ storage: browserStorage }) })
    expect(deferred.session.getState().status).toBe('anonymous')
  })

  it('without the server state the first render has no data — so the state really is what removes the flash', async () => {
    const server = await render('/', { api: backend })
    const client = renderToString(
      createClientApp({
        env: {},
        storage: browserStorage,
        state: undefined,
        Router: ({ children }: { children: ReactNode }) => (
          <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
        ),
      }),
    )
    expect(server.html).toContain('hello over the wire')
    expect(client).not.toContain('hello over the wire')
  })
})
