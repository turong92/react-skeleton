import {
  apiConfigFromEnv,
  createApiClient,
  type ApiClient,
  type AxiosAdapter,
} from '@skeleton/api-client'
import { devLoginHeaders, parseDevIdentity } from '@skeleton/auth'

/**
 * 「패키지 예제」 화면 전용 클라이언트 — 화면에서 입력한 신원을 dev-login 헤더(`X-Dev-*`)로 보낸다.
 * 받은편지함처럼 로그인한 사람의 것이 필요한 엔드포인트를 토큰 없이 눌러 보기 위한 워크벤치 방식이다(운영 앱은 starter 의 토큰 저장소).
 */
export function createPackagesDemoClient({
  getIdentity,
  env = import.meta.env,
  adapter,
}: {
  getIdentity: () => string
  env?: Record<string, unknown>
  adapter?: AxiosAdapter
}): ApiClient {
  return createApiClient({
    ...apiConfigFromEnv(env),
    adapter,
    getAuthHeaders: () => {
      const identity = getIdentity().trim()
      return identity ? devLoginHeaders(parseDevIdentity(identity)) : undefined
    },
  })
}
