import { createApiClient, type ApiClient, type AxiosAdapter } from '@skeleton/api-client'

export type ServerApiClientOptions = {
  /** 백엔드 절대 주소(`API_BASE_URL`) */
  baseUrl: string
  /** 서버 렌더가 기다리는 최대 시간(`SSR_API_TIMEOUT_MS`) */
  timeoutMs: number
  /**
   * 방문자가 쓴 Host(`a.localhost:3000`). 주면 백엔드 호출 전부에 `X-Forwarded-Host` 로 단다(`Host` 는 그대로) — 한 백엔드가 Host 로 프로젝트를 고른다.
   * 안 주면 아무것도 달지 않는다(프로젝트 하나짜리 지금 흐름). 요청마다 클라이언트를 만들어 쓴다.
   */
  forwardHost?: string
  /** 테스트용 */
  adapter?: AxiosAdapter
}

/**
 * 서버 렌더가 첫 데이터를 가져오는 클라이언트. 사용자 토큰도 시간대도 보내지 않는다(토큰은 브라우저에만 있다) —
 * 그래서 서버에서 미리 가져올 수 있는 것은 로그인 없이 읽는 공개 데이터뿐이다. 재시도 없이 한 번, 짧은 시간 제한.
 * 백엔드가 죽었거나 느리면 던지고(`CLIENT.NETWORK_ERROR`), 렌더는 데이터 없이 그린다.
 */
export function createServerApiClient({
  baseUrl,
  timeoutMs,
  forwardHost,
  adapter,
}: ServerApiClientOptions): ApiClient {
  const client = createApiClient({
    baseUrl,
    timeoutMs,
    retry: { attempts: 0 },
    adapter,
  })
  // `Host` 는 건드리지 않는다(백엔드 주소로 가는 프록시 · TLS 가 그대로) — 방문자의 Host 는 `X-Forwarded-Host` 로.
  // 인증 헤더 자리(skipAuth 면 빠진다)가 아니라 요청 가로채기로 달아, 공개 호출(`skipAuth`)에도 늘 붙는다
  if (forwardHost)
    client.axios.interceptors.request.use((config) => {
      config.headers.set('X-Forwarded-Host', forwardHost)
      return config
    })
  return client
}
