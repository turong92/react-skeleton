import type { MfaApi } from '../mfa/mfaApi'
import type { MfaStatus } from '../mfa/types'
import { apiError } from '../test/apiFixtures'

/** 스토리의 다시 인증 비밀번호 · 인증 앱이 보여 주는 코드 · 복구 코드(진짜 비밀이 아니다) */
export const FAKE_MFA_PASSWORD = 'old-password-1'
export const FAKE_TOTP_CODE = '123456'
export const FAKE_RECOVERY_CODE = 'ABCD-EFGH-JKLM-NPQR'
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
}

/** 메모리 가짜 - 다시 인증은 비밀번호만, 코드는 `FAKE_TOTP_CODE` 만 맞는다 */
export function createFakeMfaApi({
  enabled = false,
  required = false,
  remaining = 8,
  off = false,
}: FakeMfaOptions = {}) {
  let state: MfaStatus = {
    enabled,
    enabledAt: enabled ? '2026-10-01T00:00:00Z' : null,
    recoveryCodesRemaining: enabled ? remaining : 0,
    required,
  }
  const calls: string[] = []
  const proof = (input: { currentPassword?: string }) => {
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
      proof(input)
      return {
        secret: FAKE_TOTP_SECRET,
        otpauthUri: FAKE_OTPAUTH,
        qr: FAKE_QR,
        expiresAt: '2026-10-31T00:10:00Z',
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
  return { api, calls }
}
