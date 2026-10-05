import type { BreakGlassIdentity, DevLoginIdentity } from './types'

/** 입력 한 줄 → dev-login 신원: `a@b` 는 email, `acc_…` 는 accountId, 나머지는 username */
export function parseDevIdentity(value: string): DevLoginIdentity {
  const normalized = value.trim()
  if (normalized.includes('@')) return { email: normalized }
  if (normalized.startsWith('acc_')) return { accountId: normalized }
  return { username: normalized }
}

/** `Authorization` 값. 이미 `Bearer ` 로 시작하면 그대로 */
export function bearerAuthorization(accessToken: string): string {
  return accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`
}

/** 백엔드 `DevLoginAuthenticationFilter` 가 읽는 헤더 */
export function devLoginHeaders(devLogin: DevLoginIdentity): Record<string, string> {
  const headers: Record<string, string> = {}
  if (devLogin.accountId) headers['X-Dev-Account-Id'] = devLogin.accountId
  if (devLogin.username) headers['X-Dev-Username'] = devLogin.username
  if (devLogin.email) headers['X-Dev-Email'] = devLogin.email
  return headers
}

/** 백엔드 `BreakGlassAuthenticationFilter` 가 읽는 헤더 */
export function breakGlassHeaders(breakGlass: BreakGlassIdentity): Record<string, string> {
  return {
    'X-Break-Glass-Account-Id': breakGlass.accountId,
    'X-Break-Glass-Reason': breakGlass.reason,
    'X-Break-Glass-Secret': breakGlass.secret,
  }
}

export type RequestAuthOptions = {
  accessToken?: string | null
  devLogin?: DevLoginIdentity
  breakGlass?: BreakGlassIdentity
}

/** 주어진 것만 모두 합친 요청 헤더(bearer · dev-login · break-glass 는 서로 독립) */
export function requestAuthHeaders(options: RequestAuthOptions): Record<string, string> {
  return {
    ...(options.accessToken ? { Authorization: bearerAuthorization(options.accessToken) } : {}),
    ...(options.devLogin ? devLoginHeaders(options.devLogin) : {}),
    ...(options.breakGlass ? breakGlassHeaders(options.breakGlass) : {}),
  }
}

/** fetch 용: 토큰이 있으면 Bearer, 없으면 dev-login 헤더(SSE 처럼 한 가지 신원만 보낼 때) */
export function applyAuthHeaders(
  headers: Headers,
  accessToken: string,
  devLogin: DevLoginIdentity,
): void {
  const source = accessToken
    ? { Authorization: bearerAuthorization(accessToken) }
    : devLoginHeaders(devLogin)
  Object.entries(source).forEach(([name, value]) => headers.set(name, value))
}
