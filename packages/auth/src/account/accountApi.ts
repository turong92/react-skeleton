import { newIdempotencyKey, type ApiClient } from '@skeleton/api-client'
import type { AuthTokenResponse, SocialProof } from '../types'
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

/** 주소가 없는 계정(Naver 등)의 다시 인증 — 이미 연결된 제공자의 **새** 인가 코드(제공자 동의를 다시 거친다) */
export type SocialReauth = {
  provider: string
  authorizationCode: string
  redirectUri?: string
} & SocialProof

/**
 * 민감한 작업의 다시 인증 — 세 전략 중 계정에 맞는 **하나**: 비밀번호가 있으면 `currentPassword`, 주소가 있는 비밀번호 없는 계정은
 * `POST /account/reauth/confirmation` 이 메일로 보낸 6자리 `confirmationCode`(계정 + 세션에 묶인다), 주소가 없으면 `socialReauth`
 */
export type ReauthCredential = {
  currentPassword?: string
  confirmationCode?: string
  socialReauth?: SocialReauth
}

export type AccountApi = {
  /** `202 {status:'VERIFICATION_SENT', signUpId}` — 계정은 아직 없고 6자리 코드가 메일로 갔다(`verifySignUpCode`). 메일 인증을 끈 앱은 `201 {status:'CREATED'}`(signUpId 없음) */
  signUp(request: SignUpRequest): Promise<{
    status: SignUpStatus
    signUpId?: string
    /** 오늘 백엔드는 안 준다 — 주면(ISO-8601) 화면이 어림 대신 쓴다 */
    expiresAt?: string
    resendAvailableAt?: string
  }>
  /** `POST /auth/verify-email {signUpId, code}` → 이 시도에 입력한 비밀번호로 계정이 만들어지고 **바로 로그인**(토큰 응답). 400 `ACCOUNT.CODE_INVALID`(`data.attemptsLeft`) · 410 `ACCOUNT.CODE_EXPIRED` · 429 */
  verifySignUpCode(signUpId: string, code: string): Promise<AuthTokenResponse>
  /** `POST /account/verification/resend {signUpId}` — 같은 시도에 새 코드(늘 202 — 쿨다운 · 횟수 초과는 조용히 무시, 429 는 IP 한도뿐) */
  resendSignUpCode(signUpId: string, captchaToken?: string): Promise<unknown>
  forgotPassword(email: string, captchaToken?: string): Promise<void>
  resetPassword(token: string, newPassword: string): Promise<void>
  passwordPolicy(): Promise<PasswordPolicy>
  /** `POST /account/email/change/confirm {code}` → 204 — 새 주소로 간 6자리 코드를 **요청한 그 세션**에서 입력한다(다른 세션은 끊긴다). 400 `CODE_INVALID`(`attemptsLeft`) · 410 `CODE_EXPIRED` · 409 `EMAIL_TAKEN` */
  confirmEmailChangeCode(code: string): Promise<void>

  me(): Promise<AccountMe>
  updateProfile(patch: ProfilePatch): Promise<AccountMe>
  /**
   * 비밀번호가 있으면 `currentPassword`. 소셜 · 매직링크만 쓰던 계정이 첫 비밀번호를 정할 때는 `confirmationCode`
   * (`requestReauthConfirmation` 의 6자리) — 없으면 403 `REAUTH_REQUIRED`, 틀리면 400 `CODE_INVALID`, 만료 · 소진 · 다른 세션이면 410 `CODE_EXPIRED`
   */
  changePassword(request: ReauthCredential & { newPassword: string }): Promise<void>
  /** 202 — 새 주소로 6자리 코드가 갈 뿐 바로 바뀌지 않는다(`confirmEmailChangeCode`). 다시 인증: 비밀번호 · `confirmationCode` · `socialReauth`. `Idempotency-Key` 는 안 주면 만든다 */
  changeEmail(
    request: ReauthCredential & { newEmail: string },
    idempotencyKey?: string,
  ): Promise<void>

  identities(): Promise<SignInIdentity[]>
  /** 다시 인증이 필요하다(비밀번호 · 코드 · socialReauth) — DELETE 의 JSON 본문에 싣는다. 마지막 수단은 409 `LAST_SIGN_IN_METHOD` */
  unlinkIdentity(id: string, reauth?: ReauthCredential): Promise<void>
  /** 다시 인증이 필요하다(서버가 강제 · 제공자 코드를 교환하기 **전에** 검사한다 — 틀려도 같은 인가 코드로 다시 낼 수 있다) */
  linkSocial(
    provider: string,
    authorizationCode: string,
    redirectUri?: string,
    reauth?: ReauthCredential,
    /** 연결하려는 제공자 동의의 PKCE `codeVerifier` · `nonce`(최상위 필드) — 제공자가 쓸 때만 */
    proof?: SocialProof,
  ): Promise<SignInIdentity>
  /** `POST /account/reauth/confirmation` (202) — 계정 주소로 6자리 코드를 보낸다(계정 + 이 세션에 묶임 · 30분 · 5번). 새 요청이 열린 코드를 대신한다 */
  requestReauthConfirmation(): Promise<void>

  /** 비밀번호가 없는 계정의 삭제 확인 코드 메일(계정 + 이 세션에 묶임 · 재인증 코드와 별개) */
  requestDeleteConfirmation(): Promise<void>
  /** 계정에 맞는 증거 하나: `currentPassword` · 메일로 받은 `confirmationCode` · (주소 없는 계정) `socialReauth` */
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
  { deviceName }: { deviceName?: string } = {},
): AccountApi {
  const publicPost = (json: unknown) => ({ method: 'POST' as const, json, skipAuth: true })
  return {
    signUp: (request) => client.value('/account/sign-up', publicPost(request)),
    verifySignUpCode: (signUpId, code) =>
      client.value<AuthTokenResponse>('/auth/verify-email', {
        ...publicPost({ signUpId, code }),
        ...(deviceName ? { headers: { 'X-Device-Name': deviceName } } : {}),
      }),
    resendSignUpCode: (signUpId, captchaToken) =>
      client.value('/account/verification/resend', publicPost(compact({ signUpId, captchaToken }))),
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
    linkSocial: (provider, authorizationCode, redirectUri, reauth, proof) =>
      client.value(`/account/identities/social/${seg(provider)}`, {
        method: 'POST',
        json: compact({ authorizationCode, redirectUri, ...reauth, ...proof }),
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
