/** 두 번째 단계로 낼 수 있는 증거 - `totp` 6자리 인증 앱 코드 · `recovery_code` 저장해 둔 복구 코드 */
export const MFA_METHODS = ['totp', 'recovery_code'] as const
export type MfaMethod = (typeof MFA_METHODS)[number]

/**
 * 1단계가 맞은 2단계 인증 계정의 응답(`403 AUTH.MFA_REQUIRED`) - 세션은 열리지 않았다.
 * `mfaToken` 은 **메모리(라우터 state)에만** 둔다 - 저장소 · 주소에 넣지 않는다(새로고침하면 다시 로그인)
 */
export type MfaRequired = {
  mfaToken: string
  methods: MfaMethod[]
  /** 이 시각에 대기가 끝난다(ISO-8601, 서버 기준 5분) - 서버가 안 주면 null */
  expiresAt: string | null
}

/** `POST /auth/mfa/verify` 에 낼 증거 하나 - `mfaToken` 은 호출자가 붙인다 */
export type MfaVerifyInput = { code: string } | { recoveryCode: string }

/** `GET /auth/mfa` */
export type MfaStatus = {
  enabled: boolean
  enabledAt: string | null
  recoveryCodesRemaining: number
  /** 이 계정은 2단계 인증이 필수다(끌 수 없다 - 재등록은 된다) */
  required: boolean
}

/** `POST /auth/mfa/totp/enrollment` - 비밀은 이 응답에만 있다(10분, `no-store`). 확인될 때까지 켜지지 않는다 */
export type TotpEnrollment = {
  /** 인증 앱에 직접 입력하는 키(base32) */
  secret: string
  /** `otpauth://totp/…` - 앱에서 바로 열기 */
  otpauthUri: string
  /** 서버가 그린 QR - `path` 는 모듈 행렬을 `M x y h1 v1 h-1 z …` 로 이은 SVG 경로, `size` 는 한 변의 모듈 수 */
  qr: { size: number; path: string }
  expiresAt: string
}
