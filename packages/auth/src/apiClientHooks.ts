import { ApiRequestError, ErrorCodes, type HeaderRecord } from '@skeleton/api-client'
import { bearerAuthorization } from './headers'
import type { RefreshStore } from './refreshStore'
import type { TokenStore } from './tokenStore'

/** `createApiClient({ getAuthHeaders })` 에 꽂는다 — 저장소의 토큰이 바뀌면 다음 요청부터 따라간다 */
export function createAuthHeadersProvider(store: TokenStore): () => HeaderRecord | undefined {
  return () => {
    const token = store.get()
    return token ? { Authorization: bearerAuthorization(token) } : undefined
  }
}

export type UnauthorizedHandlerOptions = {
  store: TokenStore
  /** 주면 갱신 자격도 함께 비운다 — 갱신 뒤 재시도도 401 이면 세션은 끝난 것이고, 자격이 남으면 새로고침이 다시 로그인시키고 쿼리 재시도가 갱신을 되풀이한다 */
  refreshStore?: RefreshStore
  /** 세션이 끝났을 때(로그인 화면으로 보내기 등). 토큰은 이미 지운 뒤에 불린다 */
  onUnauthorized?: (error: ApiRequestError) => void
  /** 401 이어도 세션 만료가 아닌 코드. 기본: 비밀번호 틀림(`AUTH.INVALID_CREDENTIALS`) */
  ignoreCodes?: readonly string[]
}

/** `createApiClient({ onError })` 에 꽂는 401 처리 지점: 토큰을 지우고 앱에 알린다 */
export function createUnauthorizedHandler({
  store,
  refreshStore,
  onUnauthorized,
  ignoreCodes = [ErrorCodes.AUTH_INVALID_CREDENTIALS],
}: UnauthorizedHandlerOptions): (error: ApiRequestError) => void {
  return (error) => {
    if (!(error instanceof ApiRequestError) || error.apiError.status !== 401) return
    if (ignoreCodes.includes(error.apiError.code)) return
    refreshStore?.clear()
    store.clear()
    onUnauthorized?.(error)
  }
}
