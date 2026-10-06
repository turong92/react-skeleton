import {
  createAuthApi,
  createSessionRefresher,
  onAccountChange,
  type AuthApi,
  type TokenStorage,
} from '@skeleton/auth'
import {
  createLegalApi,
  createReconsentController,
  type ReconsentController,
} from '@skeleton/legal'
import { showApiError } from '@skeleton/ui'
import { hydrate } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { StrictMode, type ComponentType, type ReactElement, type ReactNode } from 'react'
import { createAppApiClient } from '../api/createAppApiClient'
import { authKeys, parseDelivery } from '../auth/authConfig'
import { createAuth, createDeferredTokens, type Auth } from '../auth/createAuth'
import type { ApiClient } from '@skeleton/api-client'
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

export type ClientRuntimeOptions = Omit<ClientAppOptions, 'Router'>

export type ClientRuntime = {
  api: ApiClient
  auth: Auth
  queryClient: QueryClient
  /** 약관 재동의(403 `LEGAL.RECONSENT_REQUIRED`) — `AppProviders` 의 `<LegalGate>` 가 화면을 그린다 */
  reconsent: ReconsentController
}

/**
 * 브라우저 앱의 살아 있는 부분 — API 클라이언트 · 세션 · 쿼리 캐시와 그 사이의 배선. 모듈 전역 없이 호출할 때마다 새로 만든다.
 * 배선: 401 → 갱신 한 번 → 재시도 한 번, 복구할 수 없는 401 은 두 저장소를 함께 비우고, 로그인한 계정이 사라지거나 바뀌면(로그아웃 ·
 * 다른 탭의 로그아웃 · 갱신 실패 · 다른 계정의 링크 로그인) 서버 상태 캐시를 비운다.
 */
export function createClientRuntime({
  env,
  storage,
  state,
  onError = (error) => showApiError(error),
  debug = false,
}: ClientRuntimeOptions): ClientRuntime {
  const tokens = createDeferredTokens({
    storage,
    storageKey: authKeys.accessToken,
    refreshStorageKey: authKeys.refresh,
  })
  const delivery = parseDelivery(env.VITE_AUTH_REFRESH_DELIVERY)
  // 401 → 갱신 한 번(single-flight) → 재시도 한 번. 갱신 호출은 이 훅이 꽂힌 클라이언트로 만든 api 라 늦게 잇는다
  const bound: { authApi?: AuthApi } = {}
  const refresher = createSessionRefresher({
    tokens: tokens.store,
    refreshTokens: tokens.refreshStore,
    delivery,
    lockName: authKeys.refreshLock,
    refresh: (refreshToken) => bound.authApi!.refresh(refreshToken),
  })
  // 재동의 컨트롤러는 클라이언트(`recoverForbidden`)보다 먼저 있고 법적 문서 API 는 클라이언트 뒤에 만들어지므로 늦게 잇는다
  const reconsent = createReconsentController({ api: () => createLegalApi(api) })
  const api = createAppApiClient({
    env,
    tokenStore: tokens.store,
    refreshStore: tokens.refreshStore,
    debug,
    recoverUnauthorized: refresher.recover,
    recoverForbidden: reconsent.recover,
    withCredentials: delivery === 'cookie',
  })
  const authApi = (bound.authApi = createAuthApi(api, { delivery }))
  const auth = createAuth({ api: authApi, tokens, delivery, refresher })
  const queryClient = createQueryClient({ onError, staleTime: QUERY_STALE_TIME_MS })
  if (state) hydrate(queryClient, state)
  // 로그인한 계정이 사라지거나 바뀔 때마다 서버 상태를 비운다 — 다음 사람에게 이전 사람의 데이터가 보이지 않게(staleTime 이 있어 재조회도 늦다)
  onAccountChange(auth.session, () => queryClient.clear())
  return { api, auth, queryClient, reconsent }
}

/**
 * 브라우저 진입점(`entry-client.tsx`)이 `hydrateRoot` 에 넘기는 트리. 서버(`entry-server.tsx`)와 같은 `AppProviders` · `AppRoutes` 를 쓰고
 * 라우터만 다르다. 모듈 전역 없이 호출할 때마다 클라이언트 · 세션 · 캐시를 새로 만든다 — 테스트가 「브라우저처럼」 그려 서버 HTML 과 대조한다.
 */
export function createClientApp({ Router, ...options }: ClientAppOptions): ReactElement {
  const { api, auth, queryClient, reconsent } = createClientRuntime(options)
  return (
    <StrictMode>
      <AppProviders queryClient={queryClient} api={api} auth={auth} reconsent={reconsent}>
        <Router>
          <AppRoutes />
        </Router>
      </AppProviders>
    </StrictMode>
  )
}
