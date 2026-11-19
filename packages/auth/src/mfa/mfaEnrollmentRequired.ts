import { ApiRequestError, type ForbiddenContext } from '@skeleton/api-client'
import { createGateCore, type GateState } from '../gateController'
import { MFA_CODES } from './codes'

/** 이 오류는 「2단계 인증을 켜 주세요」 화면이 말한다 - 전역 오류 토스트에서 뺀다 */
export function isMfaEnrollmentRequiredError(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    error.apiError.status === 403 &&
    error.apiError.code === MFA_CODES.ENROLLMENT_REQUIRED
  )
}

export type MfaEnrollmentRequiredController = {
  getState(): GateState
  subscribe(listener: () => void): () => void
  /** `createApiClient({ recoverForbidden })` 에 꽂는다 - 403 `MFA.ENROLLMENT_REQUIRED` 면 화면을 열고 등록(true) · 떠남(false)까지 호출을 붙잡는다. 다른 403 은 즉시 false */
  recover(context: ForbiddenContext): Promise<boolean>
  /** 2단계 인증을 켰다 - 화면을 닫고 붙잡은 호출을 그대로 한 번 더 보낸다(서버는 확인 직후부터 바로 연다) */
  enrolled(): void
  /** 켜지 않고 떠난다(로그아웃) - 붙잡은 호출은 원래 403 으로 끝난다 */
  decline(): void
  /** 지금 로그인한 계정을 알린다(`MfaEnrollmentRequiredGate` 가 매번) - 계정이 바뀌면 접고, 로그아웃한 뒤에 늦게 온 403 은 화면을 다시 세우지 않는다 */
  setAccount(accountId: string | null): void
}

/**
 * 2단계 인증 등록 강제의 상태 기계 - UI 가 없다(`MfaEnrollmentRequiredGate` 가 그린다). 이메일 막과 같은 상태 기계(`gateController`)다.
 * 서버는 로그인 직후부터 허용 목록 밖의 호출을 403 으로 막으므로 「미리 아는」 길은 없고, 첫 막힌 호출이 화면을 연다.
 */
export function createMfaEnrollmentRequiredController(): MfaEnrollmentRequiredController {
  const { resolve, ...core } = createGateCore(isMfaEnrollmentRequiredError)
  return {
    getState: core.getState,
    subscribe: core.subscribe,
    recover: core.recover,
    decline: core.decline,
    setAccount: core.setAccount,
    enrolled: resolve,
  }
}
