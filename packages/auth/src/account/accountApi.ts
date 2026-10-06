import { newIdempotencyKey, type ApiClient } from '@skeleton/api-client'
import type { AuthTokenResponse } from '../types'
import type {
  AccountMe,
  AccountSession,
  DeletionResult,
  PasswordPolicy,
  ProfilePatch,
  SignInIdentity,
  SignUpRequest,
  SignUpStatus,
} from './types'

/** 주소가 없는 계정(Naver 등)의 다시 인증 — 이미 연결된 제공자의 **새** 인가 코드(제공자 동의를 다시 거친다). FINAL-3 초안 */
export type SocialReauth = { provider: string; authorizationCode: string; redirectUri?: string }

/**
 * 민감한 작업의 다시 인증 — 세 전략: 비밀번호가 있으면 `currentPassword`, 주소가 있는 비밀번호 없는 계정은 메일로 받은 6자리 `confirmationCode`
 * (FINAL-3 초안; 그 전 백엔드는 링크의 `confirmationToken`), 주소가 없으면 `socialReauth`
 */
export type ReauthCredential = {
  currentPassword?: string
  /** 옛 계약(링크의 토큰) — FINAL-3 이 확정되면 `confirmationCode` 로 대체된다 */
  confirmationToken?: string
  confirmationCode?: string
  socialReauth?: SocialReauth
}

export type AccountApi = {
  /** FINAL-3 초안: 메일 인증이 켜져 있으면 `signUpId` 가 함께 온다(그 시도에 묶인 6자리 코드를 `verifySignUpCode` 에 낸다) */
  signUp(request: SignUpRequest): Promise<{ status: SignUpStatus; signUpId?: string }>
  resendVerification(email: string, captchaToken?: string): Promise<void>
  verifyEmail(token: string): Promise<void>
  /** FINAL-3 초안 `POST /auth/verify-email {signUpId, code}` → 가입이 끝나고 **바로 로그인**(토큰 응답). 400 `ACCOUNT.CODE_INVALID`(`data.attemptsLeft`) · 410 `ACCOUNT.CODE_EXPIRED` · 429 */
  verifySignUpCode(signUpId: string, code: string): Promise<AuthTokenResponse>
  /** FINAL-3 초안 `POST /account/verification/resend {signUpId}` — 같은 시도에 새 코드(늘 202 — 쿨다운 · 횟수 초과는 조용히 무시) */
  resendSignUpCode(signUpId: string, captchaToken?: string): Promise<void>
  forgotPassword(email: string, captchaToken?: string): Promise<void>
  resetPassword(token: string, newPassword: string): Promise<void>
  passwordPolicy(): Promise<PasswordPolicy>
  confirmEmailChange(token: string): Promise<void>
  /** FINAL-3 초안 `POST /account/email/change/confirm {code}` — 새 주소로 간 6자리 코드를 로그인한 채 입력한다. 400 `CODE_INVALID` · 410 `CODE_EXPIRED` · 409 `EMAIL_TAKEN` */
  confirmEmailChangeCode(code: string): Promise<void>

  me(): Promise<AccountMe>
  updateProfile(patch: ProfilePatch): Promise<AccountMe>
  /**
   * 비밀번호가 있으면 `currentPassword`. 소셜 · 매직링크만 쓰던 계정이 첫 비밀번호를 정할 때는 `confirmationToken`
   * (`requestReauthConfirmation` 의 메일 링크) — 없으면 403 `ACCOUNT.REAUTH_REQUIRED`, 틀리면 400 `ACCOUNT.REAUTH_FAILED`
   */
  changePassword(request: ReauthCredential & { newPassword: string }): Promise<void>
  /** 202 — 새 주소로 확인 메일이 갈 뿐 바로 바뀌지 않는다. 비밀번호 없는 계정은 `confirmationToken`. `Idempotency-Key` 는 안 주면 만든다 */
  changeEmail(
    request: ReauthCredential & { newEmail: string },
    idempotencyKey?: string,
  ): Promise<void>

  identities(): Promise<SignInIdentity[]>
  /** FINAL-3 초안: 다시 인증이 필요하다(비밀번호 · 코드 · socialReauth) — 본문에 싣는다 */
  unlinkIdentity(id: string, reauth?: ReauthCredential): Promise<void>
  /** 다시 인증이 필요하다: 비밀번호가 있으면 `currentPassword`, 없으면 `confirmationToken`(서버가 강제) */
  linkSocial(
    provider: string,
    authorizationCode: string,
    redirectUri?: string,
    reauth?: ReauthCredential,
  ): Promise<SignInIdentity>
  /** `POST /account/reauth/confirmation` (202) — 계정 주소로 `/confirm-reauth?token=` 링크를 보낸다(비밀번호 없는 계정의 다시 인증) */
  requestReauthConfirmation(): Promise<void>

  /** 비밀번호가 없는 계정의 삭제 확인 메일 */
  requestDeleteConfirmation(): Promise<void>
  /** 비밀번호가 있으면 `currentPassword`, 없으면 메일로 받은 `confirmationToken` 중 정확히 하나 */
  deleteAccount(credential: ReauthCredential, idempotencyKey?: string): Promise<DeletionResult>

  sessions(): Promise<AccountSession[]>
  revokeSession(id: string): Promise<void>
  /** 현재 세션만 남기고 모두 폐기(`keepCurrent=true`) */
  revokeOtherSessions(): Promise<void>
  /** 현재 세션까지 모두 폐기(`keepCurrent=false`) — 호출 뒤 이 기기도 로그아웃으로 다룬다 */
  revokeAllSessions(): Promise<void>
}

const seg = encodeURIComponent
const compact = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T

/** 백엔드 `modules/account` · `auth-session` 의 인증 필요 · 공개 엔드포인트 호출 모음. 저장 · 캐시는 하지 않는다(화면이 TanStack Query 로) */
export function createAccountApi(
  client: Pick<ApiClient, 'value' | 'list' | 'noContent'>,
): AccountApi {
  const publicPost = (json: unknown) => ({ method: 'POST' as const, json, skipAuth: true })
  return {
    signUp: (request) => client.value('/account/sign-up', publicPost(request)),
    resendVerification: async (email, captchaToken) => {
      await client.value(
        '/account/verification/resend',
        publicPost(compact({ email, captchaToken })),
      )
    },
    verifyEmail: async (token) => {
      await client.value('/auth/verify-email', publicPost({ token }))
    },
    verifySignUpCode: (signUpId, code) =>
      client.value<AuthTokenResponse>('/auth/verify-email', publicPost({ signUpId, code })),
    resendSignUpCode: async (signUpId, captchaToken) => {
      await client.value(
        '/account/verification/resend',
        publicPost(compact({ signUpId, captchaToken })),
      )
    },
    forgotPassword: async (email, captchaToken) => {
      await client.value('/account/password/forgot', publicPost(compact({ email, captchaToken })))
    },
    resetPassword: (token, newPassword) =>
      client.noContent('/account/password/reset', publicPost({ token, newPassword })),
    passwordPolicy: async () => {
      // 컨트롤러는 `maxBytes`, 계약 문서는 `maxLength` — 둘 다 받는다
      const raw = await client.value<PasswordPolicy & { maxLength?: number }>(
        '/account/password/policy',
        { skipAuth: true },
      )
      const { maxLength, ...policy } = raw
      return { ...policy, maxBytes: raw.maxBytes ?? maxLength ?? 72 }
    },
    confirmEmailChange: (token) =>
      client.noContent('/auth/confirm-email-change', publicPost({ token })),
    confirmEmailChangeCode: (code) =>
      client.noContent('/account/email/change/confirm', { method: 'POST', json: { code } }),

    me: () => client.value('/account/me'),
    updateProfile: (patch) =>
      client.value('/account/me', { method: 'PATCH', json: compact(patch) }),
    changePassword: (request) =>
      client.noContent('/account/password/change', { method: 'POST', json: compact(request) }),
    changeEmail: async (request, idempotencyKey) => {
      await client.value('/account/email/change', {
        method: 'POST',
        json: compact(request),
        idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
      })
    },

    identities: () => client.list('/account/identities'),
    unlinkIdentity: (id, reauth) =>
      client.noContent(`/account/identities/${seg(id)}`, {
        method: 'DELETE',
        ...(reauth ? { json: compact(reauth) } : {}),
      }),
    linkSocial: (provider, authorizationCode, redirectUri, reauth) =>
      client.value(`/account/identities/social/${seg(provider)}`, {
        method: 'POST',
        json: compact({ authorizationCode, redirectUri, ...reauth }),
      }),
    requestReauthConfirmation: async () => {
      await client.value('/account/reauth/confirmation', { method: 'POST' })
    },

    requestDeleteConfirmation: async () => {
      await client.value('/account/delete/confirmation', { method: 'POST' })
    },
    deleteAccount: (credential, idempotencyKey) =>
      client.value('/account/delete', {
        method: 'POST',
        json: compact(credential),
        idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
      }),

    sessions: () => client.list('/auth/sessions'),
    revokeSession: (id) => client.noContent(`/auth/sessions/${seg(id)}`, { method: 'DELETE' }),
    revokeOtherSessions: () =>
      client.noContent('/auth/sessions', { method: 'DELETE', params: { keepCurrent: true } }),
    revokeAllSessions: () =>
      client.noContent('/auth/sessions', { method: 'DELETE', params: { keepCurrent: false } }),
  }
}
