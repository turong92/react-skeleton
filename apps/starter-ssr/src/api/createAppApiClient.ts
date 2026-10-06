import {
  apiConfigFromEnv,
  createApiClient,
  type ApiClient,
  type ApiClientConfig,
  type AxiosAdapter,
  type ApiRequestError,
} from '@skeleton/api-client'
import {
  createAuthHeadersProvider,
  createUnauthorizedHandler,
  type RefreshStore,
  type TokenStore,
} from '@skeleton/auth'
import { userTimeZone } from '@skeleton/time'
import { serverClock } from './serverClock'

export type AppApiClientOptions = {
  /** `import.meta.env` — 환경변수는 앱이 읽어 넘긴다(패키지는 읽지 않는다) */
  env: Record<string, unknown>
  tokenStore: TokenStore
  /** 주면 복구할 수 없는 401 에 갱신 자격도 함께 비운다(액세스 토큰만 지우면 새로고침이 다시 로그인시킨다) */
  refreshStore?: RefreshStore
  /** 401(세션 만료) 뒤 — 토큰은 이미 지워졌다. 라우트 가드가 로그인으로 보내므로 보통 필요 없다 */
  onUnauthorized?: (error: ApiRequestError) => void
  /** 401 → 토큰 갱신 → 한 번 재시도(`@skeleton/auth` 의 `createSessionRefresher().recover`) */
  recoverUnauthorized?: ApiClientConfig['recoverUnauthorized']
  /** 쿠키 모드(리프레시 토큰이 HttpOnly 쿠키)면 true */
  withCredentials?: boolean
  /** true 면 요청마다 콘솔 로그(보통 `import.meta.env.DEV`) */
  debug?: boolean
  /** 테스트용 */
  adapter?: AxiosAdapter
}

/**
 * 앱의 API 클라이언트 — 이 파일이 환경변수 · 인증 · 시간대 · 서버 시각을 한곳에서 잇는다.
 * VITE_API_BASE_URL · VITE_API_TIMEOUT_MS · VITE_API_RETRY_ATTEMPTS · VITE_API_RETRY_DELAY_MS 는 `apiConfigFromEnv` 가 읽는다.
 */
export function createAppApiClient({
  env,
  tokenStore,
  refreshStore,
  onUnauthorized,
  recoverUnauthorized,
  withCredentials,
  debug = false,
  adapter,
}: AppApiClientOptions): ApiClient {
  return createApiClient({
    ...apiConfigFromEnv(env),
    adapter,
    debug,
    recoverUnauthorized,
    withCredentials,
    getAuthHeaders: createAuthHeadersProvider(tokenStore),
    getTimeZone: userTimeZone,
    onResponseDate: (date) => serverClock.observeDateHeader(date),
    onError: createUnauthorizedHandler({ store: tokenStore, refreshStore, onUnauthorized }),
  })
}
