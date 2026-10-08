import { ApiRequestError, ErrorCodes, type ForbiddenContext } from '@skeleton/api-client'
import { createGateCore, type GateState } from './gateController'

/** 이 오류는 「아이디를 정해 주세요」 화면이 말한다 — 전역 오류 토스트에서 뺀다 */
export function isLoginIdRequiredError(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    error.apiError.status === 403 &&
    error.apiError.code === ErrorCodes.ACCOUNT_LOGIN_ID_REQUIRED
  )
}

export type LoginIdRequiredState = GateState

export type LoginIdRequiredController = {
  getState(): LoginIdRequiredState
  subscribe(listener: () => void): () => void
  /** `createApiClient({ recoverForbidden })` 에 꽂는다 — 403 `ACCOUNT.LOGIN_ID_REQUIRED` 면 화면을 열고 아이디를 정할(true) · 떠날(false) 때까지 호출을 붙잡는다. 다른 403 은 즉시 false */
  recover(context: ForbiddenContext): Promise<boolean>
  /** 로그인 직후 `me.loginId === null` 을 알았다 — 붙잡을 호출 없이 화면만 연다 */
  require(): void
  /** 아이디를 정했다 — 화면을 닫고 붙잡은 호출을 그대로 한 번 더 보낸다 */
  chosen(): void
  /** 이 계정이 아이디를 정해야 하는지 서버에 물어 답을 받았는가(`LoginIdGate` 가 정한다) — 아니면 이메일 · 약관 막 같은 **다음 단계**가 아직 묻기 시작하면 안 된다(순서는 아이디 → 이메일 → 약관) */
  isReady(): boolean
  setReady(ready: boolean): void
  /** 정하지 않고 떠난다(로그아웃 · 계정 삭제) — 붙잡은 호출은 원래 403 으로 끝난다 */
  decline(): void
  /** 지금 로그인한 계정을 알린다(`LoginIdGate` 가 매번) — 계정이 바뀌면 `decline()` 과 같이 접고, 로그아웃한 뒤에 늦게 온 403 은 화면을 다시 세우지 않는다 */
  setAccount(accountId: string | null): void
}

/**
 * 아이디 정하기 강제의 상태 기계 — UI 가 없다(`LoginIdGate` 가 이 상태를 그린다). `createEmailRequiredController` 와 같은 상태 기계(`gateController`)다.
 * 403 `ACCOUNT.LOGIN_ID_REQUIRED` 는 로그아웃도 토큰 갱신도 아니다: 정하고 나면 막혔던 호출을 **그대로 한 번 더** 보내 가던 자리에서 이어진다.
 */
export function createLoginIdRequiredController(): LoginIdRequiredController {
  const { resolve, ...core } = createGateCore(isLoginIdRequiredError)
  return { ...core, chosen: resolve }
}
