import type { MfaApi } from '../mfa/mfaApi'
import type { MfaStatus } from '../mfa/types'
import { apiError } from '../test/apiFixtures'

/** 스토리의 다시 인증 비밀번호 · 인증 앱이 보여 주는 코드 · 복구 코드(진짜 비밀이 아니다) */
export const FAKE_MFA_PASSWORD = 'old-password-1'
export const FAKE_TOTP_CODE = '123456'
export const FAKE_RECOVERY_CODE = 'ABCD-EFGH-JKLM-NPQR'
/** 제공자 동의 왕복에서 받은 새 인가 코드 - 한 번 쓰면 끝이다(다시 쓰면 `ACCOUNT.REAUTH_FAILED`) */
export const FAKE_SOCIAL_CODE = 'provider-code-1'
export const FAKE_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
export const FAKE_RECOVERY_CODES = Array.from(
  { length: 10 },
  (_, i) => `RC${String(i).padStart(2, '0')}-AAAA-BBBB-CCCC`,
)
export const FAKE_OTPAUTH = `otpauth://totp/Notes:ann%40example.com?secret=${FAKE_TOTP_SECRET}&issuer=Notes`
/** 서버가 만든 QR 의 모양만 닮은 작은 경로 - 한 칸이 한 `M x y h1 v1 h-1 z` */
export const FAKE_QR = {
  size: 21,
  path: 'M0 0h7v7H0zM2 2h3v3H2zM14 0h7v7h-7zM16 2h3v3h-3zM0 14h7v7H0zM2 16h3v3H2zM9 9h3v3H9z',
}

export type FakeMfaOptions = {
  enabled?: boolean
  required?: boolean
  remaining?: number
  /** 서버가 2단계 인증 모듈을 켜지 않았다(404) */
  off?: boolean
  /** 필수 문의 등록 면제 - 방금 로그인했으면 서버가 증거 없는 등록 시작(`{}`)을 받는다. 아니면 `ACCOUNT.REAUTH_REQUIRED`(403) */
  exempt?: boolean
}

/** 메모리 가짜 - 다시 인증은 비밀번호만, 코드는 `FAKE_TOTP_CODE` 만 맞는다 */
export function createFakeMfaApi({
  enabled = false,
  required = false,
  remaining = 8,
  off = false,
  exempt = false,
}: FakeMfaOptions = {}) {
  let state: MfaStatus = {
    enabled,
    enabledAt: enabled ? '2026-10-01T00:00:00Z' : null,
    recoveryCodesRemaining: enabled ? remaining : 0,
    required,
  }
  const calls: string[] = []
  /** 서버에 닿은 본문 - 증거가 실렸는지 본다 */
  const inputs: unknown[] = []
  const usedSocial = new Set<string>()
  const proof = (input: {
    currentPassword?: string
    socialReauth?: { authorizationCode: string }
  }) => {
    inputs.push(input)
    if (input.socialReauth) {
      const code = input.socialReauth.authorizationCode
      if (code !== FAKE_SOCIAL_CODE || usedSocial.has(code))
        throw apiError('ACCOUNT.REAUTH_FAILED', 400)
      usedSocial.add(code)
      return
    }
    if (input.currentPassword !== FAKE_MFA_PASSWORD)
      throw apiError('ACCOUNT.CURRENT_PASSWORD_INVALID', 400)
  }
  const gone = () => {
    if (off) throw apiError('COMMON.NOT_FOUND', 404)
  }
  const api: MfaApi = {
    status: async () => {
      gone()
      return { ...state }
    },
    startEnrollment: async (input) => {
      calls.push('startEnrollment')
      if (Object.keys(input).length === 0) {
        inputs.push(input)
        if (!exempt) throw apiError('ACCOUNT.REAUTH_REQUIRED', 403)
      } else proof(input)
      return {
        secret: FAKE_TOTP_SECRET,
        otpauthUri: FAKE_OTPAUTH,
        qr: FAKE_QR,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), // 진짜 시계로 10분 - 고정 시각이면 날이 지나 만료로 보인다
      }
    },
    confirmEnrollment: async (code) => {
      calls.push('confirmEnrollment')
      if (code !== FAKE_TOTP_CODE) throw apiError('MFA.CODE_INVALID', 400)
      const first = !state.enabled
      state = {
        ...state,
        enabled: true,
        enabledAt: '2026-10-31T00:00:00Z',
        recoveryCodesRemaining: first ? 10 : state.recoveryCodesRemaining,
      }
      return { recoveryCodes: first ? FAKE_RECOVERY_CODES : null }
    },
    regenerateRecoveryCodes: async (input) => {
      calls.push('regenerateRecoveryCodes')
      proof(input)
      state = { ...state, recoveryCodesRemaining: 10 }
      return { recoveryCodes: FAKE_RECOVERY_CODES }
    },
    disable: async (input) => {
      calls.push('disable')
      proof(input)
      if (state.required) throw apiError('MFA.REQUIRED_BY_POLICY', 409)
      const ok =
        ('code' in input && input.code === FAKE_TOTP_CODE) ||
        ('recoveryCode' in input && input.recoveryCode === FAKE_RECOVERY_CODE)
      if (!ok) throw apiError('MFA.CODE_INVALID', 400)
      state = { ...state, enabled: false, enabledAt: null, recoveryCodesRemaining: 0 }
    },
  }
  return { api, calls, inputs: () => inputs }
}
