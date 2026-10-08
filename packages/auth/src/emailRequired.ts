import { ApiRequestError, ErrorCodes, type ForbiddenContext } from '@skeleton/api-client'

/** 이 오류는 「이메일을 등록해 주세요」 화면이 말한다 — 전역 오류 토스트에서 뺀다 */
export function isEmailRequiredError(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    error.apiError.status === 403 &&
    error.apiError.code === ErrorCodes.ACCOUNT_EMAIL_REQUIRED
  )
}

export type EmailRequiredState = { status: 'idle' } | { status: 'required' }

export type EmailRequiredController = {
  getState(): EmailRequiredState
  subscribe(listener: () => void): () => void
  /** `createApiClient({ recoverForbidden })` 에 꽂는다 — 403 `ACCOUNT.EMAIL_REQUIRED` 면 화면을 열고 주소가 등록(true) · 떠남(false)할 때까지 호출을 붙잡는다. 다른 403 은 즉시 false */
  recover(context: ForbiddenContext): Promise<boolean>
  /** 로그인 직후 `me.emailRequired === true` 를 알았다 — 붙잡을 호출 없이 화면만 연다 */
  require(): void
  /** 주소가 등록됐다 — 화면을 닫고 붙잡은 호출을 그대로 한 번 더 보낸다 */
  registered(): void
  /**
   * 이 계정이 주소를 요구받는지 서버에 물어 답을 받았는가(`EmailRequiredGate` 가 정한다) — 아니면 약관 막 같은 **다음 단계**가 아직 묻기 시작하면 안 된다(순서는 이메일 → 약관).
   * 처음에는 false, 게이트가 `me` 를 읽고 나서 true, 계정이 바뀌거나 로그아웃하면 다시 false
   */
  isReady(): boolean
  setReady(ready: boolean): void
  /** 등록하지 않고 떠난다(로그아웃 · 계정 삭제) — 붙잡은 호출은 원래 403 으로 끝난다 */
  decline(): void
}

const IDLE: EmailRequiredState = { status: 'idle' }
const REQUIRED: EmailRequiredState = { status: 'required' }

/**
 * 이메일 등록 강제의 상태 기계 — UI 가 없다(`EmailRequiredGate` 가 이 상태를 그린다). 같은 때에 막힌 호출들은 하나의 화면을 공유한다.
 * 403 은 로그아웃도 토큰 갱신도 아니다: 등록이 끝나면 막혔던 호출을 **그대로 한 번 더** 보내 가던 자리에서 이어진다(api-client 의 `recoverForbidden`).
 */
export function createEmailRequiredController(): EmailRequiredController {
  let state: EmailRequiredState = IDLE
  let ready = false
  const listeners = new Set<() => void>()
  let waiters: Array<(value: boolean) => void> = []

  const set = (next: EmailRequiredState) => {
    if (next === state) return
    state = next
    for (const listener of [...listeners]) listener()
  }
  const release = (value: boolean) => {
    const done = waiters
    waiters = []
    for (const resolve of done) resolve(value)
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    async recover({ error }) {
      if (!isEmailRequiredError(error)) return false
      set(REQUIRED)
      return new Promise<boolean>((resolve) => waiters.push(resolve))
    },
    isReady: () => ready,
    setReady(next) {
      if (next === ready) return
      ready = next
      for (const listener of [...listeners]) listener()
    },
    require: () => set(REQUIRED),
    registered() {
      set(IDLE)
      release(true)
    },
    decline() {
      set(IDLE)
      release(false)
    },
  }
}
