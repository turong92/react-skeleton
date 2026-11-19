import type { ApiClient } from '@skeleton/api-client'
import type { AuthTokenResponse } from './types'

export type WebHandoffApi = {
  /**
   * `POST /auth/web-handoff/redeem {code}` (백엔드 `auth-web-handoff`, 공개) - 앱이 낸 한 번 쓰는 코드를 웹 로그인 응답으로 바꾼다.
   * 쓸 수 없는 코드(만료 · 이미 씀 · 앱 세션이 닫힘)는 410 `ACCOUNT.TOKEN_INVALID`, 2단계 인증 계정은 403 `AUTH.MFA_REQUIRED`
   */
  redeem(code: string, options?: { deviceName?: string }): Promise<AuthTokenResponse>
}

/** 웹 결제로 넘어온 사용자의 코드 교환. 응답은 일반 로그인 응답이라 `auth.signIn(response)` 로 세션에 들인다 */
export function createWebHandoffApi(
  client: Pick<ApiClient, 'value'>,
  { base = '/auth/web-handoff' }: { base?: string } = {},
): WebHandoffApi {
  const root = base.replace(/\/+$/, '')
  return {
    redeem: (code, options) =>
      client.value<AuthTokenResponse>(`${root}/redeem`, {
        method: 'POST',
        json: { code },
        skipAuth: true,
        ...(options?.deviceName ? { headers: { 'X-Device-Name': options.deviceName } } : {}),
      }),
  }
}
