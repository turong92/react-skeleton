import { newIdempotencyKey, type ApiClient } from '@skeleton/api-client'
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

export type AccountApi = {
  signUp(request: SignUpRequest): Promise<{ status: SignUpStatus }>
  resendVerification(email: string, captchaToken?: string): Promise<void>
  verifyEmail(token: string): Promise<void>
  forgotPassword(email: string, captchaToken?: string): Promise<void>
  resetPassword(token: string, newPassword: string): Promise<void>
  passwordPolicy(): Promise<PasswordPolicy>
  confirmEmailChange(token: string): Promise<void>

  me(): Promise<AccountMe>
  updateProfile(patch: ProfilePatch): Promise<AccountMe>
  /** 소셜 · 매직링크만 쓰던 계정은 `currentPassword` 없이 첫 비밀번호를 정한다 */
  changePassword(request: { currentPassword?: string; newPassword: string }): Promise<void>
  /** 202 — 새 주소로 확인 메일이 갈 뿐 바로 바뀌지 않는다. `Idempotency-Key` 는 안 주면 만든다 */
  changeEmail(
    request: { newEmail: string; currentPassword?: string },
    idempotencyKey?: string,
  ): Promise<void>

  identities(): Promise<SignInIdentity[]>
  unlinkIdentity(id: string): Promise<void>
  linkSocial(
    provider: string,
    authorizationCode: string,
    redirectUri?: string,
  ): Promise<SignInIdentity>

  /** 비밀번호가 없는 계정의 삭제 확인 메일 */
  requestDeleteConfirmation(): Promise<void>
  /** 비밀번호가 있으면 `currentPassword`, 없으면 메일로 받은 `confirmationToken` 중 정확히 하나 */
  deleteAccount(
    credential: { currentPassword?: string; confirmationToken?: string },
    idempotencyKey?: string,
  ): Promise<DeletionResult>

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
    forgotPassword: async (email, captchaToken) => {
      await client.value('/account/password/forgot', publicPost(compact({ email, captchaToken })))
    },
    resetPassword: (token, newPassword) =>
      client.noContent('/account/password/reset', publicPost({ token, newPassword })),
    passwordPolicy: () => client.value('/account/password/policy', { skipAuth: true }),
    confirmEmailChange: (token) =>
      client.noContent('/auth/confirm-email-change', publicPost({ token })),

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
    unlinkIdentity: (id) =>
      client.noContent(`/account/identities/${seg(id)}`, { method: 'DELETE' }),
    linkSocial: (provider, authorizationCode, redirectUri) =>
      client.value(`/account/identities/social/${seg(provider)}`, {
        method: 'POST',
        json: compact({ authorizationCode, redirectUri }),
      }),

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
