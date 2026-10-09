import { ApiRequestError, ErrorCodes, type ForbiddenContext } from '@skeleton/api-client'
import type { AccountMe } from './account/types'
import type { SocialReauth } from './account/accountApi'
import { createGateCore, type GateState } from './gateController'

/** 이 오류는 「이메일을 등록해 주세요」 화면이 말한다 — 전역 오류 토스트에서 뺀다 */
export function isEmailRequiredError(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    error.apiError.status === 403 &&
    error.apiError.code === ErrorCodes.ACCOUNT_EMAIL_REQUIRED
  )
}

export type EmailRequiredState = GateState

/**
 * 서버가 주소를 **언제** 요구하는가 — `me` 에서 읽는다.
 * `login` 로그인 직후(허용 목록 밖은 읽기도 403) · `write` 쓰기 때(읽기는 되고 변경 요청만 403) · `none` 요구하지 않는다(주소가 있거나 이 앱은 안 받는다) · `unknown` 아직 `me` 를 못 읽었다
 */
export type EmailRequiredWhen = 'unknown' | 'none' | 'login' | 'write'

type EmailRequirementFields = Pick<AccountMe, 'email' | 'emailRequired' | 'emailRequiredToWrite'>

/** `me` 가 말하는 방식. 두 키가 모두 true 로 오면(없는 일) 로그인 직후가 이긴다 — 더 센 쪽이다 */
export function emailWhenOf(
  me: Partial<EmailRequirementFields>,
): Exclude<EmailRequiredWhen, 'unknown'> {
  if (me.emailRequired === true) return 'login'
  if (me.emailRequiredToWrite === true) return 'write'
  return 'none'
}

/**
 * 「다른 탭에서 등록했나」를 보는 판정 — 이 계정에 주소가 **없고** 서버가 아직 요구하는가.
 * 쓰기 때 방식에서는 `emailRequired` 가 늘 false 라 그 값만 보면 막이 뜨자마자 접힌다 — 주소가 생겼는지가 먼저다.
 * 요구하는 키가 하나도 없는 응답(옛 서버 · `emailRequired: false`)은 예전처럼 접는다
 */
export function stillNeedsAddress(me: Partial<EmailRequirementFields>): boolean {
  if (me.email) return false
  return emailWhenOf(me) !== 'none'
}

/** 제공자 재확인을 다녀온 뒤 막이 이어 갈 것 - 적던 주소와 새 인가 코드(한 번만 쓸 수 있다) */
export type EmailRequiredResume = { newEmail: string; socialReauth: SocialReauth }

export type EmailRequiredController = {
  getState(): EmailRequiredState
  subscribe(listener: () => void): () => void
  /** `createApiClient({ recoverForbidden })` 에 꽂는다 — 403 `ACCOUNT.EMAIL_REQUIRED` 면 화면을 열고 주소가 등록(true) · 떠남(false)할 때까지 호출을 붙잡는다. 다른 403 은 즉시 false */
  recover(context: ForbiddenContext): Promise<boolean>
  /** 로그인 직후 `me.emailRequired === true` 를 알았다 — 붙잡을 호출 없이 화면만 연다 */
  require(): void
  /** 주소가 등록됐다 — 화면을 닫고 붙잡은 호출을 그대로 한 번 더 보낸다. 서버가 요구하는 것도 이제 없다(`none`) */
  registered(): void
  /** 서버가 주소를 언제 요구하는가(`EmailRequiredGate` 가 `me` 를 읽고 알린다) - 화면의 모습(`write` 면 「나중에 하기」가 있는 쓰기용)과 `useEmailBeforeWrite` 가 읽는다. 처음엔 `unknown` */
  getWhen(): EmailRequiredWhen
  setWhen(when: EmailRequiredWhen): void
  /**
   * 이 계정이 주소를 요구받는지 서버에 물어 답을 받았는가(`EmailRequiredGate` 가 정한다) — 아니면 약관 막 같은 **다음 단계**가 아직 묻기 시작하면 안 된다(순서는 이메일 → 약관).
   * 처음에는 false, 게이트가 `me` 를 읽고 나서 true, 계정이 바뀌거나 로그아웃하면 다시 false
   */
  isReady(): boolean
  setReady(ready: boolean): void
  /** 제공자 재확인에서 돌아왔다 - 막을 열고 이 값을 쥔다. 화면이 받아 인증번호 요청을 이어 가고 `clearResume()` 한다(메모리에만 둔다) */
  offerResume(resume: EmailRequiredResume): void
  getResume(): EmailRequiredResume | null
  clearResume(): void
  /** 등록하지 않고 떠난다(로그아웃 · 계정 삭제) — 붙잡은 호출은 원래 403 으로 끝난다 */
  decline(): void
  /**
   * 지금 로그인한 계정을 알린다(`EmailRequiredGate` 가 매번). 화면 · 붙잡은 호출은 한 계정의 것이다 — **계정이 바뀌면**(다른 탭에서 다른 계정으로 로그인 · 로그아웃) `decline()` 과 같이 접는다.
   * 로그아웃한 뒤(`null`)에 늦게 도착한 403 은 화면을 다시 세우지 않는다. 한 번도 알리지 않은 컨트롤러는 예전처럼 계정을 가리지 않는다
   */
  setAccount(accountId: string | null): void
}

/**
 * 이메일 등록 강제의 상태 기계 — UI 가 없다(`EmailRequiredGate` 가 이 상태를 그린다). 같은 때에 막힌 호출들은 하나의 화면을 공유한다.
 * 403 은 로그아웃도 토큰 갱신도 아니다: 등록이 끝나면 막혔던 호출을 **그대로 한 번 더** 보내 가던 자리에서 이어진다(api-client 의 `recoverForbidden`).
 * 아이디 막(`createLoginIdRequiredController`)과 같은 상태 기계(`gateController`)를 쓴다.
 */
export function createEmailRequiredController(): EmailRequiredController {
  const { resolve, ...core } = createGateCore(isEmailRequiredError)
  let when: EmailRequiredWhen = 'unknown'
  const listeners = new Set<() => void>()
  const setWhen = (next: EmailRequiredWhen) => {
    if (next === when) return
    when = next
    for (const listener of [...listeners]) listener()
  }
  let resume: EmailRequiredResume | null = null
  const setResume = (next: EmailRequiredResume | null) => {
    if (next === resume) return
    resume = next
    for (const listener of [...listeners]) listener()
  }
  return {
    ...core,
    offerResume(next) {
      setResume(next)
      core.require()
    },
    getResume: () => resume,
    clearResume: () => setResume(null),
    decline() {
      setResume(null)
      core.decline()
    },
    subscribe(listener) {
      listeners.add(listener)
      const stopCore = core.subscribe(listener)
      return () => {
        listeners.delete(listener)
        stopCore()
      }
    },
    registered() {
      // 먼저 알려 둔다 - 붙잡힌 호출이 풀려 다시 나갈 때 이미 요구가 없다(모르던 것은 그대로 모른다)
      if (when === 'login' || when === 'write') setWhen('none')
      setResume(null)
      resolve()
    },
    getWhen: () => when,
    setWhen,
  }
}
