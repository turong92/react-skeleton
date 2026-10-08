import { newIdempotencyKey, type ApiClient } from '@skeleton/api-client'
import type { AuthTokenResponse, SocialProof } from '../types'
import type {
  AccountMe,
  AccountSession,
  DeletionResult,
  LoginIdAvailability,
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

/**
 * 6자리 코드를 보내는 요청(`email/change` · `reauth/confirmation` · `delete/confirmation`)의 응답 — 백엔드가 만료 · 재요청 가능 시각(ISO-8601)을 주면 남은 시간을 서버 값으로 센다.
 * 옛 서버는 본문이 없다(undefined) — 화면이 문서화된 유효 시간으로 어림한다(`codeWindowOf`)
 */
export type CodeSent = { expiresAt?: string; resendAvailableAt?: string | null } | undefined

export type AccountApi = {
  /** `202 {status:'VERIFICATION_SENT', signUpId}` — 계정은 아직 없고 6자리 코드가 메일로 갔다(`verifySignUpCode`). 메일 인증을 끈 앱은 `201 {status:'CREATED'}`(signUpId 없음) */
  signUp(request: SignUpRequest): Promise<{
    status: SignUpStatus
    signUpId?: string
    /** 최신 백엔드가 준다(ISO-8601) — 없으면(옛 서버) 화면이 문서화된 유효 시간으로 어림한다 */
    expiresAt?: string
    /** `null` 이면 이 시도는 더 다시 보낼 수 없다 */
    resendAvailableAt?: string | null
  }>
  /** `POST /auth/verify-email {signUpId, code, displayName?}`(409 `DISPLAY_NAME_TAKEN` · `LOGIN_ID_TAKEN` 은 시도를 닫지 않는다 — 같은 코드로 다른 닉네임 · 아이디를 다시 `{displayName?, loginId?}`) → 이 시도에 입력한 비밀번호로 계정이 만들어지고 **바로 로그인**(토큰 응답). 400 `ACCOUNT.CODE_INVALID`(`data.attemptsLeft`) · 410 `ACCOUNT.CODE_EXPIRED` · 429 */
  verifySignUpCode(
    signUpId: string,
    code: string,
    options?: { displayName?: string; loginId?: string },
  ): Promise<AuthTokenResponse>
  /** `POST /account/verification/resend {signUpId}` — 같은 시도에 새 코드(늘 202 — 쿨다운 · 횟수 초과는 조용히 무시, 429 는 IP 한도뿐) */
  resendSignUpCode(signUpId: string, captchaToken?: string): Promise<unknown>
  forgotPassword(email: string, captchaToken?: string): Promise<void>
  /**
   * 로그인 아이디(서버가 켠 앱만 - 꺼져 있으면 아래 셋은 404) 실시간 확인 - `POST /account/login-id/availability {loginId}`. 로그인 없이 부른다(가입 양식)
   * 로그인한 계정도 부른다. 형식 오류도 200 이다(`reason: 'INVALID'` + `code`). 429 `ACCOUNT.RATE_LIMITED` 는 「확인 못 함」이지 거절이 아니다
   */
  checkLoginId(loginId: string): Promise<LoginIdAvailability>
  /**
   * `POST /account/login-id {loginId}` → `me` 와 같은 본문 - 아이디를 **한 번** 정한다(이메일이 없어도 된다). 400(필드 `loginId`) · 409 `LOGIN_ID_TAKEN` ·
   * 409 `LOGIN_ID_ALREADY_SET` · 403 `NOT_ACTIVE` · 429. 바꾸는 API 는 없다
   */
  setLoginId(loginId: string): Promise<AccountMe>
  /** `POST /account/login-id/forgot {email, captchaToken?}` → 늘 202(계정이 있든 없든 같다) - 그 주소가 계정 이메일이면 아이디를 메일로 보낸다. 429 는 IP 한도 */
  forgotLoginId(email: string, captchaToken?: string): Promise<void>
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
  ): Promise<CodeSent>

  /**
   * 연락받을 이메일(선택 · 계정당 하나 · 로그인과 복구에는 쓰이지 않는다) — `POST /account/contact-email {email}` → 202. 인증번호가 **그 주소로** 간다. 다시 보내기 = 다시 부른다.
   * 다시 인증은 없다 - **계정 이메일이 없는 계정**(이메일을 필수로 켜지 않은 앱)만 `socialReauth` 가 든다(`403 REAUTH_REQUIRED` · `400 REAUTH_FAILED`).
   * 앱이 기능을 끄면 `me.contactEmail` 키가 없고 요청은 404 다 - 화면은 그 구역을 그리지 않는다
   */
  requestContactEmail(
    email: string,
    reauth?: Pick<ReauthCredential, 'socialReauth'>,
  ): Promise<CodeSent>
  /** `POST /account/contact-email/confirm {code}` → 204 — 바뀐다(이미 있던 주소를 대신한다). 400 `CODE_INVALID` · 410 `CODE_EXPIRED` · 429 */
  confirmContactEmail(code: string): Promise<void>
  /** `DELETE /account/contact-email` → 204 — 없을 때도 204. 이후 서비스 알림은 계정 이메일로 간다 */
  removeContactEmail(): Promise<void>

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
  /** `POST /account/reauth/confirmation` (202) — 계정 주소로 6자리 코드를 보낸다(계정 + 이 세션에 묶임 · 10분 · 5번). 새 요청이 열린 코드를 대신한다 */
  requestReauthConfirmation(): Promise<CodeSent>

  /**
   * 등록 미완료 계정 버리기 - `POST /account/discard`: 주소를 한 번도 가진 적 없는 계정을 **유예 없이 즉시** 지우고 소셜 수단을 풀어 준다(같은 사람이 이미 메일 계정이 있는데 소셜로 들어와 빈 계정이 생겼을 때).
   * 본문 `{}`(방금 로그인한 세션) 또는 `{ socialReauth }`(오래된 세션 - 아니면 403 `REAUTH_REQUIRED`). 204 = 모든 세션이 닫혔다(호출자가 로컬 세션을 지운다).
   * 409 `DISCARD_NOT_ALLOWED`(주소가 있다 · 이메일 필수 아님 · 활성 아님) · 409 `LAST_ADMIN` · 503 `ERASURE_RETRY`(다시 부른다)
   */
  discardAccount(
    reauth?: Pick<ReauthCredential, 'socialReauth'>,
    idempotencyKey?: string,
  ): Promise<void>
  /** 비밀번호가 없는 계정의 삭제 확인 코드 메일(계정 + 이 세션에 묶임 · 재인증 코드와 별개) */
  requestDeleteConfirmation(): Promise<CodeSent>
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
    verifySignUpCode: (signUpId, code, options) =>
      client.value<AuthTokenResponse>('/auth/verify-email', {
        ...publicPost(
          compact({
            signUpId,
            code,
            displayName: options?.displayName,
            loginId: options?.loginId,
          }),
        ),
        ...(deviceName ? { headers: { 'X-Device-Name': deviceName } } : {}),
      }),
    resendSignUpCode: (signUpId, captchaToken) =>
      client.value('/account/verification/resend', publicPost(compact({ signUpId, captchaToken }))),
    forgotPassword: async (email, captchaToken) => {
      await client.value('/account/password/forgot', publicPost(compact({ email, captchaToken })))
    },
    checkLoginId: (loginId) =>
      client.value('/account/login-id/availability', publicPost({ loginId })),
    setLoginId: (loginId) =>
      client.value('/account/login-id', { method: 'POST', json: { loginId } }),
    forgotLoginId: async (email, captchaToken) => {
      await client.value('/account/login-id/forgot', publicPost(compact({ email, captchaToken })))
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
    changeEmail: (request, idempotencyKey) =>
      client.value<CodeSent>('/account/email/change', {
        method: 'POST',
        json: compact(request),
        idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
      }),

    requestContactEmail: (email, reauth) =>
      client.value<CodeSent>('/account/contact-email', {
        method: 'POST',
        json: compact({ email, ...reauth }),
      }),
    confirmContactEmail: (code) =>
      client.noContent('/account/contact-email/confirm', { method: 'POST', json: { code } }),
    removeContactEmail: () => client.noContent('/account/contact-email', { method: 'DELETE' }),

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
    requestReauthConfirmation: () =>
      client.value<CodeSent>('/account/reauth/confirmation', { method: 'POST' }),

    requestDeleteConfirmation: () =>
      client.value<CodeSent>('/account/delete/confirmation', { method: 'POST' }),
    discardAccount: (reauth, idempotencyKey) =>
      client.noContent('/account/discard', {
        method: 'POST',
        json: compact({ ...reauth }),
        idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
      }),
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
