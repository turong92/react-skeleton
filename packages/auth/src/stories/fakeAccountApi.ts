import { ApiRequestError } from '@skeleton/api-client'
import type { AccountApi } from '../account/accountApi'
import type { AccountMe, AccountSession, PasswordPolicy, SignInIdentity } from '../account/types'

export const FAKE_POLICY: PasswordPolicy = {
  minLength: 10,
  maxBytes: 72,
  requireLetter: true,
  requireDigit: true,
  requireSymbol: false,
  forbidEmailLocalPart: true,
}

export const apiError = (code: string, status: number, data?: unknown) =>
  new ApiRequestError(
    { code, title: code, status, timestamp: '2026-01-01T00:00:00Z', data },
    'trace-demo',
    'span-demo',
    '00-trace-demo-span-demo-01',
  )

const identity = (over: Partial<SignInIdentity>): SignInIdentity => ({
  id: 'idn_pw',
  method: 'password',
  subject: 'ann@example.com',
  verified: true,
  createdAt: '2026-01-01T00:00:00Z',
  lastUsedAt: '2026-10-05T09:00:00Z',
  removable: true,
  ...over,
})

export type FakeAccountOptions = {
  /** 비밀번호 없이 소셜로만 가입한 계정 */
  passwordless?: boolean
  /** 로그인 수단이 하나뿐 */
  onlyMethod?: boolean
  /** 새 주소의 확인을 기다리는 이메일 변경이 이미 있다(새로고침 뒤) */
  pendingEmail?: string
  /** FINAL-3 초안: 가입이 `signUpId` 를 돌려주고 6자리 코드로 인증한다(코드는 `FAKE_CODE`) */
  codeFlow?: boolean
}

/** 가짜 서버가 받아 주는 6자리 코드 */
export const FAKE_CODE = '123456'

/** 가짜 서버가 받아 주는 본인 확인 토큰(메일 링크의 값) */
export const FAKE_REAUTH_TOKEN = 'tok'

/** 백엔드 없이 도는 `AccountApi` — 상태를 기억하고 계약의 오류 코드(현재 비밀번호 틀림 · 마지막 수단 …)를 낸다. 스토리 · 테스트 전용 */
export function createFakeAccountApi(options: FakeAccountOptions = {}): AccountApi & {
  calls: string[]
} {
  const calls: string[] = []
  const methods: SignInIdentity[] = options.passwordless
    ? [identity({ id: 'idn_g', method: 'google', subject: null })]
    : options.onlyMethod
      ? [identity({ removable: false })]
      : [identity({}), identity({ id: 'idn_g', method: 'google', subject: null })]
  const me: AccountMe = {
    id: 'acc_demo',
    email: 'ann@example.com',
    emailVerified: true,
    displayName: 'Ann',
    locale: 'en',
    timeZone: 'Asia/Seoul',
    roles: ['USER'],
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    hasPassword: !options.passwordless,
    methods,
    pendingEmail: options.pendingEmail ?? null,
    pendingEmailExpiresAt: options.pendingEmail ? '2026-10-06T10:00:00Z' : null,
  }
  /** 서버가 강제하는 다시 인증 — 비밀번호가 있으면 현재 비밀번호, 없으면 메일 링크의 토큰 */
  const reauth = (c: { currentPassword?: string; confirmationToken?: string }) => {
    if (me.hasPassword) {
      if (c.currentPassword !== 'old-password-1')
        throw apiError('ACCOUNT.CURRENT_PASSWORD_INVALID', 400)
      return
    }
    if (!c.confirmationToken) throw apiError('ACCOUNT.REAUTH_REQUIRED', 403)
    if (c.confirmationToken !== FAKE_REAUTH_TOKEN) throw apiError('ACCOUNT.REAUTH_FAILED', 400)
  }
  let sessions: AccountSession[] = [
    {
      id: 'ses_1',
      deviceName: 'This laptop',
      userAgent: null,
      ip: '203.0.113.7',
      createdAt: '2026-10-01T00:00:00Z',
      lastUsedAt: '2026-10-06T08:00:00Z',
      current: true,
    },
    {
      id: 'ses_2',
      deviceName: 'Pixel 9',
      userAgent: null,
      ip: '198.51.100.4',
      createdAt: '2026-09-20T00:00:00Z',
      lastUsedAt: '2026-10-04T18:30:00Z',
      current: false,
    },
    {
      id: 'ses_3',
      deviceName: null,
      userAgent: null,
      ip: null,
      createdAt: '2026-09-01T00:00:00Z',
      lastUsedAt: '2026-09-30T10:00:00Z',
      current: false,
    },
  ]
  let attemptsLeft = 5
  const track = <T>(name: string, value: T) => {
    calls.push(name)
    return Promise.resolve(value)
  }
  return {
    calls,
    signUp: () =>
      track('signUp', {
        status: 'VERIFICATION_SENT' as const,
        ...(options.codeFlow ? { signUpId: 'sid-1' } : {}),
      }),
    verifySignUpCode: async (_signUpId, code) => {
      calls.push('verifySignUpCode')
      if (code !== FAKE_CODE) {
        attemptsLeft -= 1
        if (attemptsLeft <= 0) throw apiError('ACCOUNT.CODE_EXPIRED', 410)
        throw apiError('ACCOUNT.CODE_INVALID', 400, { attemptsLeft })
      }
      return {
        accessToken: 'fake',
        tokenType: 'Bearer',
        expiresAt: '2099-01-01T00:00:00Z',
        principal: { accountId: 'acc_demo', roles: [] },
      }
    },
    resendSignUpCode: () => track('resendSignUpCode', undefined),
    confirmEmailChangeCode: () => track('confirmEmailChangeCode', undefined),
    resendVerification: () => track('resendVerification', undefined),
    verifyEmail: () => track('verifyEmail', undefined),
    forgotPassword: () => track('forgotPassword', undefined),
    resetPassword: () => track('resetPassword', undefined),
    passwordPolicy: () => track('passwordPolicy', FAKE_POLICY),
    confirmEmailChange: () => track('confirmEmailChange', undefined),
    me: () => track('me', { ...me, methods: [...methods] }),
    updateProfile: (patch) => {
      Object.assign(me, patch)
      return track('updateProfile', { ...me })
    },
    changePassword: async ({ currentPassword, confirmationToken }) => {
      calls.push('changePassword')
      reauth({ currentPassword, confirmationToken })
      if (!me.hasPassword) {
        me.hasPassword = true
        methods.push(identity({ id: 'idn_pw2' }))
      }
    },
    changeEmail: async ({ newEmail, currentPassword, confirmationToken }) => {
      calls.push('changeEmail')
      reauth({ currentPassword, confirmationToken })
      me.pendingEmail = newEmail
      me.pendingEmailExpiresAt = '2026-10-06T10:00:00Z'
    },
    requestReauthConfirmation: () => track('requestReauthConfirmation', undefined),
    identities: () => track('identities', [...methods]),
    unlinkIdentity: async (id) => {
      calls.push(`unlink:${id}`)
      if (methods.length <= 1) throw apiError('ACCOUNT.LAST_SIGN_IN_METHOD', 409)
      methods.splice(
        methods.findIndex((m) => m.id === id),
        1,
      )
    },
    linkSocial: async (_provider, _code, _uri, c) => {
      calls.push('linkSocial')
      reauth({ currentPassword: c?.currentPassword, confirmationToken: c?.confirmationToken })
      return identity({ id: 'idn_k', method: 'kakao', subject: null })
    },
    requestDeleteConfirmation: () => track('requestDeleteConfirmation', undefined),
    deleteAccount: async ({ currentPassword, confirmationToken }) => {
      calls.push('deleteAccount')
      if (me.hasPassword ? currentPassword !== 'old-password-1' : confirmationToken !== 'tok')
        throw apiError('ACCOUNT.REAUTH_FAILED', 400)
      return { status: 'DELETION_SCHEDULED' as const, purgeAfter: '2026-11-05T00:00:00Z' }
    },
    sessions: () => track('sessions', [...sessions]),
    revokeSession: async (id) => {
      calls.push(`revoke:${id}`)
      sessions = sessions.filter((s) => s.id !== id)
    },
    revokeOtherSessions: async () => {
      calls.push('revokeOthers')
      sessions = sessions.filter((s) => s.current)
    },
    revokeAllSessions: async () => {
      calls.push('revokeAll')
      sessions = []
    },
  }
}
