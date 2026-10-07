import { ApiRequestError } from '@skeleton/api-client'
import type { AccountApi, ReauthCredential } from '../account/accountApi'
import type { AccountMe, AccountSession, PasswordPolicy, SignInIdentity } from '../account/types'

export const FAKE_POLICY: PasswordPolicy = {
  minLength: 10,
  maxBytes: 72,
  requireLetter: true,
  requireDigit: true,
  requireSymbol: false,
  forbidEmailLocalPart: true,
}

/** 필드 오류가 있는 400(`errors[]`) — 서버의 message 는 영어다(화면은 그대로 보이지 않는다) */
export const fieldError = (field: string, code: string, message: string) =>
  new ApiRequestError(
    {
      code: 'COMMON.VALIDATION_FAILED',
      title: 'Validation failed',
      status: 400,
      timestamp: '2026-01-01T00:00:00Z',
      errors: [{ field, code, message }],
    } as never,
    'trace-demo',
    'span-demo',
    '00-trace-demo-span-demo-01',
  )

export const apiError = (code: string, status: number, data?: unknown) =>
  new ApiRequestError(
    { code, title: code, status, timestamp: '2026-01-01T00:00:00Z', data },
    'trace-demo',
    'span-demo',
    '00-trace-demo-span-demo-01',
  )

/** 지금부터 n분 뒤의 ISO 시각 — 코드 만료는 시계에 따라 달라지므로 고정 날짜를 쓰면 스토리가 곧 만료된 화면이 된다 */
const inMinutes = (minutes: number): string => new Date(Date.now() + minutes * 60_000).toISOString()

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
  /** 비밀번호 없이 소셜 · 링크로만 가입한 계정(주소는 있다) */
  passwordless?: boolean
  /** 이메일 주소가 없는 계정(Naver 등) — 이미 연결된 제공자로 다시 동의해 본인 확인 */
  noAddress?: boolean
  /** 주소 없는 계정의 유일한 로그인 수단(LINE · X). 없으면 naver + magic_link */
  noAddressProvider?: string
  /** 로그인 수단이 하나뿐 */
  onlyMethod?: boolean
  /** 새 주소의 인증번호를 기다리는 이메일 변경이 이미 있다(새로고침 뒤) */
  pendingEmail?: string
  /** 그 요청의 만료까지 남은 분(기본 10 — 백엔드 `email-change.ttl`). 서버가 말해 주는 `pendingEmailExpiresAt` 이 된다 */
  pendingExpiresInMinutes?: number
  /** 메일 인증을 끈 앱 — 가입이 바로 `CREATED` */
  verificationOff?: boolean
  /** 정지된 계정 — 스스로 탈퇴할 수 없다(`delete` · `delete/confirmation` → 403 `ACCOUNT.SUSPENDED_CANNOT_DELETE`) */
  suspended?: boolean
  /** 가입이 막힌 주소 — 코드를 맞게 입력해도 `verify-email` 이 403 `ACCOUNT.REGISTRATION_BLOCKED`(메일함을 증명한 사람에게만 보인다) */
  registrationBlocked?: boolean
  /**
   * 새 백엔드처럼 코드를 보내는 요청(`email/change` · `reauth/confirmation` · `delete/confirmation`)이 응답에 `expiresAt` · `resendAvailableAt` 을 준다 —
   * 지금부터 n분 뒤 만료. 없으면 옛 서버처럼 본문이 없다(화면이 어림한다)
   */
  codeWindowMinutes?: number
  /** 서버가 붙인 4자리 꼬리표(`Ann#4821`) — `GET /account/me` 의 `displayTag` */
  displayTag?: string
  /** 이미 쓰고 있는 닉네임들 — 프로필 수정이 409 `ACCOUNT.DISPLAY_NAME_TAKEN`(닉네임 중복 금지 서버). 앞뒤 공백을 뗀 값으로 견준다 */
  takenNicknames?: string[]
  /** 닉네임을 이만큼 바꾸면 다음 변경이 429 `ACCOUNT.RATE_LIMITED`(`retryAfterSeconds` 3시간 12분) — 서버의 `display-name.change-limit` */
  nicknameChangeLimit?: number
  /** 서버 규칙으로 쓸 수 없는 닉네임(400, 필드 `displayName`, 코드 `Reserved`, 영어 message) */
  reservedNicknames?: string[]
  /** 코드를 보내는 요청의 응답이 `resendAvailableAt: null` — 이 시도는 더 다시 보낼 수 없다(FINAL-5 R2) */
  resendExhausted?: boolean
}

/** 가짜 서버가 받아 주는 6자리 코드(가입 · 이메일 변경 · 다시 인증 · 삭제 모두) */
export const FAKE_CODE = '123456'

/** 가짜 서버가 받아 주는 주소 없는 계정의 제공자 증명(새 인가 코드) */
export const FAKE_SOCIAL_REAUTH = { provider: 'naver', authorizationCode: 'fresh-code' }

/** 백엔드 없이 도는 `AccountApi` — 상태를 기억하고 계약의 오류 코드(현재 비밀번호 틀림 · 인증번호 틀림 · 마지막 수단 …)를 낸다. 스토리 · 테스트 전용 */
export function createFakeAccountApi(options: FakeAccountOptions = {}): AccountApi & {
  calls: string[]
} {
  const calls: string[] = []
  const methods: SignInIdentity[] = options.noAddressProvider
    ? [
        identity({
          id: 'idn_p',
          method: options.noAddressProvider,
          subject: null,
          removable: false,
        }),
      ]
    : options.noAddress
      ? [
          identity({ id: 'idn_n', method: 'naver', subject: null }),
          identity({ id: 'idn_m', method: 'magic_link' }),
        ]
      : options.passwordless
        ? [
            identity({ id: 'idn_g', method: 'google', subject: null }),
            identity({ id: 'idn_m', method: 'magic_link' }),
          ]
        : options.onlyMethod
          ? [identity({ removable: false })]
          : [identity({}), identity({ id: 'idn_g', method: 'google', subject: null })]
  const me: AccountMe = {
    id: 'acc_demo',
    email: options.noAddress ? null : 'ann@example.com',
    emailVerified: !options.noAddress,
    displayName: 'Ann',
    displayTag: options.displayTag ?? null,
    locale: 'en',
    timeZone: 'Asia/Seoul',
    roles: ['USER'],
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    hasPassword: !options.passwordless && !options.noAddress,
    methods,
    pendingEmail: options.pendingEmail ?? null,
    pendingEmailExpiresAt: options.pendingEmail
      ? inMinutes(options.pendingExpiresInMinutes ?? 10)
      : null,
  }
  /** 코드를 보내는 요청의 응답 본문 — `codeWindowMinutes` 가 있을 때만 서버 값을 준다 */
  const codeSent = () =>
    options.codeWindowMinutes === undefined
      ? undefined
      : {
          expiresAt: inMinutes(options.codeWindowMinutes),
          resendAvailableAt: options.resendExhausted
            ? null
            : new Date(Date.now() + 30_000).toISOString(),
        }
  const notSuspended = () => {
    if (options.suspended) throw apiError('ACCOUNT.SUSPENDED_CANNOT_DELETE', 403)
  }
  let codeAttempts = 5
  const wrongCode = () => {
    codeAttempts -= 1
    if (codeAttempts <= 0) throw apiError('ACCOUNT.CODE_EXPIRED', 410)
    throw apiError('ACCOUNT.CODE_INVALID', 400, { attemptsLeft: codeAttempts })
  }
  /** 서버가 강제하는 다시 인증 — 비밀번호가 있으면 현재 비밀번호, 없으면 메일로 받은 6자리, 주소도 없으면 제공자 증명 */
  const reauth = (
    c: ReauthCredential = {},
    wrongPasswordCode = 'ACCOUNT.CURRENT_PASSWORD_INVALID',
  ) => {
    if (me.hasPassword) {
      if (c.currentPassword !== 'old-password-1') throw apiError(wrongPasswordCode, 400)
      return
    }
    if (me.email) {
      if (!c.confirmationCode) throw apiError('ACCOUNT.REAUTH_REQUIRED', 403)
      if (c.confirmationCode !== FAKE_CODE) wrongCode()
      return
    }
    if (!c.socialReauth) throw apiError('ACCOUNT.REAUTH_REQUIRED', 403)
    if (c.socialReauth.authorizationCode !== FAKE_SOCIAL_REAUTH.authorizationCode)
      throw apiError('ACCOUNT.REAUTH_FAILED', 400)
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
  let nicknameChanges = 0
  const track = <T>(name: string, value: T) => {
    calls.push(name)
    return Promise.resolve(value)
  }
  return {
    calls,
    signUp: () =>
      track('signUp', {
        ...(options.verificationOff
          ? { status: 'CREATED' as const }
          : { status: 'VERIFICATION_SENT' as const, signUpId: 'sid-1' }),
      }),
    verifySignUpCode: async (_signUpId, code) => {
      calls.push('verifySignUpCode')
      if (code !== FAKE_CODE) wrongCode()
      if (options.registrationBlocked) throw apiError('ACCOUNT.REGISTRATION_BLOCKED', 403)
      return {
        accessToken: 'fake',
        tokenType: 'Bearer',
        expiresAt: '2099-01-01T00:00:00Z',
        principal: { accountId: 'acc_demo', roles: [] },
      }
    },
    resendSignUpCode: () => track('resendSignUpCode', undefined),
    confirmEmailChangeCode: async (code) => {
      calls.push('confirmEmailChangeCode')
      if (!me.pendingEmail) throw apiError('ACCOUNT.CODE_EXPIRED', 410)
      if (code !== FAKE_CODE) wrongCode()
      me.email = me.pendingEmail
      me.pendingEmail = null
      me.pendingEmailExpiresAt = null
    },
    forgotPassword: () => track('forgotPassword', undefined),
    resetPassword: () => track('resetPassword', undefined),
    passwordPolicy: () => track('passwordPolicy', FAKE_POLICY),
    me: () => track('me', { ...me, methods: [...methods] }),
    updateProfile: (patch) => {
      if (patch.displayName && options.takenNicknames?.includes(patch.displayName.trim()))
        return Promise.reject(apiError('ACCOUNT.DISPLAY_NAME_TAKEN', 409))
      if (patch.displayName && options.reservedNicknames?.includes(patch.displayName.trim()))
        return Promise.reject(
          fieldError('displayName', 'Reserved', 'English from the server: reserved nickname'),
        )
      if (patch.displayName && patch.displayName.trim() !== me.displayName) {
        if (
          options.nicknameChangeLimit !== undefined &&
          nicknameChanges >= options.nicknameChangeLimit
        )
          return Promise.reject(
            apiError('ACCOUNT.RATE_LIMITED', 429, { retryAfterSeconds: 3 * 3600 + 12 * 60 }),
          )
        nicknameChanges += 1
      }
      Object.assign(me, patch)
      return track('updateProfile', { ...me })
    },
    changePassword: async ({ currentPassword, confirmationCode }) => {
      calls.push('changePassword')
      reauth({ currentPassword, confirmationCode })
      if (!me.hasPassword) {
        me.hasPassword = true
        methods.push(identity({ id: 'idn_pw2' }))
      }
    },
    changeEmail: async ({ newEmail, ...proof }) => {
      calls.push('changeEmail')
      reauth(proof)
      me.pendingEmail = newEmail
      me.pendingEmailExpiresAt = inMinutes(options.codeWindowMinutes ?? 10)
      return codeSent()
    },
    requestReauthConfirmation: () => track('requestReauthConfirmation', codeSent()),
    identities: () => track('identities', [...methods]),
    unlinkIdentity: async (id, proof) => {
      calls.push(`unlink:${id}`)
      reauth(proof)
      if (methods.length <= 1) throw apiError('ACCOUNT.LAST_SIGN_IN_METHOD', 409)
      methods.splice(
        methods.findIndex((m) => m.id === id),
        1,
      )
    },
    linkSocial: async (_provider, _code, _uri, c) => {
      calls.push('linkSocial')
      reauth(c)
      return identity({ id: 'idn_k', method: 'kakao', subject: null })
    },
    requestDeleteConfirmation: async () => {
      notSuspended()
      return track('requestDeleteConfirmation', codeSent())
    },
    deleteAccount: async (proof) => {
      calls.push('deleteAccount')
      notSuspended()
      reauth(proof, 'ACCOUNT.REAUTH_FAILED')
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
