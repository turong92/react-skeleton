import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import type { AuthApi, AuthPrincipal, AuthTokenResponse } from '@skeleton/auth'

/** 데모 계정 — 화면에 그대로 적어 둔다(진짜 비밀이 아니다) */
export const DEMO_LOGIN = { email: 'demo@example.com', password: 'demo' }

const principal: AuthPrincipal = {
  accountId: 'acct-demo',
  username: 'demo',
  email: DEMO_LOGIN.email,
  roles: ['USER'],
}

const token = (): AuthTokenResponse => ({
  accessToken: 'fake-access-token',
  tokenType: 'Bearer',
  expiresAt: '2099-01-01T00:00:00Z',
  principal,
})

const invalidCredentials = () =>
  new ApiRequestError(
    {
      code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      title: 'Invalid credentials',
      status: 401,
      timestamp: '2026-01-01T00:00:00Z',
    },
    'trace-demo',
    'span-demo',
    '00-trace-demo-span-demo-01',
  )

/** 백엔드 없이 도는 `AuthApi` — 데모 계정만 로그인된다 */
export function createFakeAuthApi(): AuthApi {
  return {
    login: async ({ email, password }) => {
      if (email === DEMO_LOGIN.email && password === DEMO_LOGIN.password) return token()
      throw invalidCredentials()
    },
    socialLogin: async () => token(),
    me: async () => principal,
  }
}
