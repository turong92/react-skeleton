import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import type { AuthApi } from '../authApi'
import type { AuthPrincipal, AuthTokenResponse } from '../types'

/** 데모 계정 — 화면에 그대로 적어 둔다(진짜 비밀이 아니다) */
export const DEMO_LOGIN = { email: 'demo@example.com', password: 'demo' }

const principal: AuthPrincipal = {
  accountId: 'acct-demo',
  username: 'demo',
  email: DEMO_LOGIN.email,
  roles: ['USER'],
}

/** 서명 없는 JWT 꼴 — 이미 로그인한 상태로 시작하려면 `store.set(FAKE_ACCESS_TOKEN)` */
export const FAKE_ACCESS_TOKEN = `header.${btoa(
  JSON.stringify({
    sub: principal.accountId,
    username: principal.username,
    email: principal.email,
    roles: principal.roles,
  }),
)
  .replaceAll('+', '-')
  .replaceAll('/', '_')
  .replaceAll('=', '')}.signature`

const token = (): AuthTokenResponse => ({
  accessToken: FAKE_ACCESS_TOKEN,
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
    refresh: async () => token(),
    logout: async () => undefined,
    methods: async () => ({
      methods: ['password', 'magic_link'],
      signUp: { password: true, emailVerification: true, social: true },
      social: [],
      captchaRequired: false,
      refreshDelivery: 'body',
    }),
    magicLinkRequest: async () => undefined,
    magicLinkRedeem: async () => token(),
  }
}
