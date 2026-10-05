import { createAuthApi, type TokenStorage } from '@skeleton/auth'
import { showApiError } from '@skeleton/ui'
import { hydrate } from '@tanstack/react-query'
import { StrictMode, type ComponentType, type ReactElement, type ReactNode } from 'react'
import { createAppApiClient } from '../api/createAppApiClient'
import { createAuth, createDeferredTokens } from '../auth/createAuth'
import { AppProviders } from './AppProviders'
import { AppRoutes } from './AppRoutes'
import { QUERY_STALE_TIME_MS } from './constants'
import { createQueryClient } from './createQueryClient'

export type ClientAppOptions = {
  /** `import.meta.env` — 환경변수는 앱이 읽어 넘긴다 */
  env: Record<string, unknown>
  /** 토큰을 둘 브라우저 저장소(`sessionStorage`). 없으면 메모리만 */
  storage?: TokenStorage
  /** 서버가 HTML 에 넣어 보낸 쿼리 캐시(`readSsrState`) — 첫 그림부터 데이터가 있다 */
  state?: unknown
  /** 브라우저는 `BrowserRouter`(진입점이 넘긴다). 테스트는 `MemoryRouter` */
  Router: ComponentType<{ children: ReactNode }>
  /** 쿼리 · 뮤테이션 에러(기본: 토스트) */
  onError?: (error: unknown) => void
  debug?: boolean
}

/**
 * 브라우저 진입점(`entry-client.tsx`)이 `hydrateRoot` 에 넘기는 트리. 서버(`entry-server.tsx`)와 같은 `AppProviders` · `AppRoutes` 를 쓰고
 * 라우터만 다르다. 모듈 전역 없이 호출할 때마다 클라이언트 · 세션 · 캐시를 새로 만든다 — 테스트가 「브라우저처럼」 그려 서버 HTML 과 대조한다.
 */
export function createClientApp({
  env,
  storage,
  state,
  Router,
  onError = (error) => showApiError(error),
  debug = false,
}: ClientAppOptions): ReactElement {
  const tokens = createDeferredTokens({ storage })
  const api = createAppApiClient({ env, tokenStore: tokens.store, debug })
  const auth = createAuth({ api: createAuthApi(api), tokens })
  const queryClient = createQueryClient({ onError, staleTime: QUERY_STALE_TIME_MS })
  if (state) hydrate(queryClient, state)
  return (
    <StrictMode>
      <AppProviders queryClient={queryClient} api={api} auth={auth}>
        <Router>
          <AppRoutes />
        </Router>
      </AppProviders>
    </StrictMode>
  )
}
