import {
  apiConfigFromEnv,
  createApiClient,
  type ApiBasicResponse,
  type AxiosAdapter,
  type ApiClient,
  type ApiCursorResponse,
  type ApiHttpResponse,
  type ApiPageResponse,
  type ApiRequest,
} from '@skeleton/api-client'
import { requestAuthHeaders, type RequestAuthOptions } from '@skeleton/auth'
import { createServerClock, userTimeZone } from '@skeleton/time'

/**
 * 워크벤치 전용 API 진입점. 환경변수 · 시간대 · 서버 시각 연결은 앱이 한다(패키지는 `import.meta.env` 를 읽지 않는다).
 * 워크벤치는 요청마다 어떤 신원(bearer · dev-login · break-glass)으로 부를지 고르므로 요청 옵션에
 * `accessToken` · `devLogin` · `breakGlass` 를 받아 헤더로 바꾼다 — 토큰 저장소를 쓰는 앱은 starter 를 보라.
 */

/** 서버 시각 보정 (응답 Date 헤더). 카운트다운·마감 판정은 `serverClock.now()` 로 */
export const serverClock = createServerClock()

const envConfig = apiConfigFromEnv(import.meta.env)
export const API_BASE_URL = envConfig.baseUrl

export type ApiRequestInit = ApiRequest & RequestAuthOptions

export function createWorkbenchApiClient(
  options: {
    env?: Record<string, unknown>
    adapter?: AxiosAdapter
  } = {},
): ApiClient {
  return createApiClient({
    ...apiConfigFromEnv(options.env ?? import.meta.env),
    adapter: options.adapter,
    debug: import.meta.env.DEV,
    // 기기 시간대를 보내 백엔드 modules:time 이 같은 시간대로 문구를 만들게
    getTimeZone: userTimeZone,
    // 응답 Date 헤더로 서버 시각 보정
    onResponseDate: (date) => serverClock.observeDateHeader(date),
  })
}

let apiHttpClient: ApiClient = createWorkbenchApiClient()

export function apiEndpoint(path: string): string {
  return apiHttpClient.endpoint(path)
}

export async function api<T>(path: string, init?: ApiRequestInit): Promise<T> {
  return apiValue<T>(path, init)
}

export async function apiBasic(path: string, init?: ApiRequestInit): Promise<ApiBasicResponse> {
  return apiHttpClient.basic(path, toRequest(init))
}

export async function apiValue<T>(path: string, init?: ApiRequestInit): Promise<T> {
  return apiHttpClient.value<T>(path, toRequest(init))
}

export async function apiList<T>(path: string, init?: ApiRequestInit): Promise<T[]> {
  return apiHttpClient.list<T>(path, toRequest(init))
}

export async function apiPage<T>(path: string, init?: ApiRequestInit): Promise<ApiPageResponse<T>> {
  return apiHttpClient.page<T>(path, toRequest(init))
}

export async function apiCursor<T>(
  path: string,
  init?: ApiRequestInit,
): Promise<ApiCursorResponse<T>> {
  return apiHttpClient.cursor<T>(path, toRequest(init))
}

export async function apiEnvelope<TEnvelope>(
  path: string,
  init?: ApiRequestInit,
): Promise<TEnvelope> {
  return apiHttpClient.envelope<TEnvelope>(path, toRequest(init))
}

export async function apiResponse<TEnvelope = unknown>(
  path: string,
  init?: ApiRequestInit,
): Promise<ApiHttpResponse<TEnvelope>> {
  return apiHttpClient.response<TEnvelope>(path, toRequest(init))
}

export function setApiHttpClientForTesting(nextClient: ApiClient): () => void {
  const previous = apiHttpClient
  apiHttpClient = nextClient
  return () => {
    apiHttpClient = previous
  }
}

/** 신원 옵션 → 헤더(요청에 직접 적은 `headers` 가 먼저 오고 신원 헤더가 덮는다 — 예전 클라이언트와 같은 순서) */
function toRequest(init: ApiRequestInit | undefined): ApiRequest | undefined {
  if (!init) return undefined
  const { accessToken, devLogin, breakGlass, headers, ...request } = init
  return {
    ...request,
    headers: { ...headers, ...requestAuthHeaders({ accessToken, devLogin, breakGlass }) },
  }
}
