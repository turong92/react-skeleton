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

const token = (withoutAddress = false): AuthTokenResponse => ({
  accessToken: FAKE_ACCESS_TOKEN,
  tokenType: 'Bearer',
  expiresAt: '2099-01-01T00:00:00Z',
  principal: withoutAddress ? { ...principal, email: null } : principal,
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

/** 가짜 서버가 탈퇴 대기 계정의 로그인에 내주는 취소용 토큰 */
export const FAKE_RESTORE_TOKEN = 'restore-opaque'

export type FakeAuthOptions = {
  /**
   * 데모 계정이 탈퇴 유예 중이다 — 맞는 증거(비밀번호 · 링크 · 소셜)로 로그인하면 세션 대신 `403 AUTH.ACCOUNT_DELETION_PENDING`.
   * `with-token`: self-restore 가 켜져 `restoreToken` 이 온다 · `no-token`: 꺼져서 날짜만
   */
  pendingDeletion?: 'with-token' | 'no-token'
  /** 취소하려는 사이 토큰이 만료됐다 — `delete/cancel` 이 410 `ACCOUNT.TOKEN_INVALID` */
  cancelExpired?: boolean
  /** 소셜 로그인이 「같은 이메일로 메일 가입한 계정이 있다」로 거절된다 — `409 ACCOUNT.SOCIAL_EMAIL_CONFLICT`(본문 `data` 없음: 어떤 방법으로 가입했는지는 알려 주지 않는다) */
  socialEmailConflict?: boolean
  /** 소셜 로그인이 주소 없는 계정을 연다(카카오 · 네이버 · X · LINE 이 이메일을 주지 않았다) — 이메일이 필수인 앱이면 `GET /account/me` 의 `emailRequired` 가 true 인 계정(`createFakeAccountApi({ emailRequired })`) */
  socialWithoutAddress?: boolean
}

const apiFailure = (code: string, status: number, data?: unknown) =>
  new ApiRequestError(
    { code, title: code, status, timestamp: '2026-01-01T00:00:00Z', data },
    'trace-demo',
    'span-demo',
    '00-trace-demo-span-demo-01',
  )

/** 백엔드 없이 도는 `AuthApi` — 데모 계정만 로그인된다 */
export function createFakeAuthApi({
  pendingDeletion,
  cancelExpired,
  socialEmailConflict,
  socialWithoutAddress,
}: FakeAuthOptions = {}): AuthApi {
  /** 맞는 증거로 들어왔다 — 유예 중이면 세션 대신 403 */
  const admit = (): AuthTokenResponse => {
    if (!pendingDeletion) return token()
    throw apiFailure('AUTH.ACCOUNT_DELETION_PENDING', 403, {
      purgeAfter: '2026-11-05T00:00:00Z',
      ...(pendingDeletion === 'with-token'
        ? {
            restoreToken: FAKE_RESTORE_TOKEN,
            restoreTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          }
        : {}),
    })
  }
  return {
    login: async ({ email, password }) => {
      if (email === DEMO_LOGIN.email && password === DEMO_LOGIN.password) return admit()
      throw invalidCredentials()
    },
    cancelDeletion: async (restoreToken) => {
      if (cancelExpired || pendingDeletion !== 'with-token' || restoreToken !== FAKE_RESTORE_TOKEN)
        throw apiFailure('ACCOUNT.TOKEN_INVALID', 410)
      return token()
    },
    socialLogin: async () => {
      if (socialEmailConflict) throw apiFailure('ACCOUNT.SOCIAL_EMAIL_CONFLICT', 409)
      return socialWithoutAddress && !pendingDeletion ? token(true) : admit()
    },
    me: async () => (socialWithoutAddress ? { ...principal, email: null } : principal),
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
    magicLinkRedeem: async () => admit(),
  }
}
