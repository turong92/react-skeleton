import type { ApiClient } from '@skeleton/api-client'
import type { ReauthCredential } from '../account/accountApi'
import type { MfaStatus, TotpEnrollment } from './types'

export type MfaApi = {
  /** `GET /auth/mfa` - 켜짐 · 켠 시각 · 남은 복구 코드 · 필수 여부. 모듈이 꺼진 서버는 404 */
  status(): Promise<MfaStatus>
  /** `POST /auth/mfa/totp/enrollment {다시 인증}` - 비밀 · `otpauth://` · QR 경로. 확인 전에는 켜지지 않는다 */
  startEnrollment(proof: ReauthCredential): Promise<TotpEnrollment>
  /**
   * `POST /auth/mfa/totp/enrollment/confirm {code}` - 처음 켜면 복구 코드 10개(**한 번뿐**), 재등록이면 `null`(기존 코드 유지).
   * 켤 때 서버가 이 세션 말고 다른 세션을 모두 닫는다
   */
  confirmEnrollment(code: string): Promise<{ recoveryCodes: string[] | null }>
  /** `POST /auth/mfa/recovery-codes {다시 인증}` - 새 10개(이전 코드는 그 순간 죽는다) */
  regenerateRecoveryCodes(proof: ReauthCredential): Promise<{ recoveryCodes: string[] }>
  /** `POST /auth/mfa/disable {다시 인증, code | recoveryCode}` → 204. 필수 대상은 409 `MFA.REQUIRED_BY_POLICY` */
  disable(input: ReauthCredential & ({ code: string } | { recoveryCode: string })): Promise<void>
}

/**
 * 2단계 인증 설정 HTTP(백엔드 `auth-mfa`). 다시 인증 증거(`currentPassword` · `confirmationCode` · `socialReauth`)는 본문에 평평하게 싣는다(계정 API 의 비밀번호 변경과 같은 꼴).
 * 로그인의 두 번째 단계(`POST /auth/mfa/verify`)는 세션이 없을 때 부르는 공개 호출이라 `AuthApi.mfaVerify` 에 있다
 */
export function createMfaApi(
  client: Pick<ApiClient, 'value' | 'noContent'>,
  { base = '/auth/mfa' }: { base?: string } = {},
): MfaApi {
  const root = base.replace(/\/+$/, '')
  return {
    status: () => client.value<MfaStatus>(root),
    startEnrollment: (proof) =>
      client.value<TotpEnrollment>(`${root}/totp/enrollment`, { method: 'POST', json: proof }),
    confirmEnrollment: (code) =>
      client.value<{ recoveryCodes: string[] | null }>(`${root}/totp/enrollment/confirm`, {
        method: 'POST',
        json: { code },
      }),
    regenerateRecoveryCodes: (proof) =>
      client.value<{ recoveryCodes: string[] }>(`${root}/recovery-codes`, {
        method: 'POST',
        json: proof,
      }),
    disable: (input) => client.noContent(`${root}/disable`, { method: 'POST', json: input }),
  }
}
