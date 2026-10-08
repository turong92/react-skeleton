import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { LoginIdRules } from '../account/loginIdRules'
import type { LoginIdAvailability } from '../account/types'
import {
  createLoginIdChecker,
  loginIdCheckState,
  type LoginIdAnswers,
  type LoginIdCheckState,
} from './loginIdAvailability'

/** 칸이 읽는 쪽 - 상태와 `touch()` */
export type LoginIdFieldCheck = LoginIdCheckState & {
  /** 칸을 벗어났거나 내려 한다 — 형식 오류를 칸 옆에 드러낸다. 칸이 `onBlur` 에서 부르고, 부모는 제출 단추에서 부른다 */
  touch: () => void
}

export type LoginIdCheck = LoginIdFieldCheck & {
  /** 서버가 내는 순간 이 값을 쓸 수 없다고 했다(409) - 「쓸 수 있어요」가 남지 않게 그 값을 「쓸 수 없다」로 적는다. 인자는 정규화한 값 */
  markTaken: (normalized: string) => void
}

export type UseLoginIdAvailabilityOptions = {
  /** `checkLoginId` 만 쓴다 — `accountApi` 를 그대로 넘기면 된다 */
  api: { checkLoginId: (loginId: string) => Promise<LoginIdAvailability> }
  /** 입력한 그대로의 값(부모가 쥔다) */
  value: string
  /** `GET /auth/methods` 의 `loginId` 규칙 */
  rules: LoginIdRules
}

const NO_ANSWERS: LoginIdAnswers = {}

/**
 * 아이디 칸의 실시간 확인 — 입력이 멈춘 뒤 0.4초에, 형식이 맞을 때만 묻는다. 값이 바뀌면 늦게 온 답은 버리고 같은 값은 다시 묻지 않는다.
 * 돌려주는 것: `status`(형식 안 맞음 · 확인하는 중 · 쓸 수 있다 · 쓸 수 없다 · 확인하지 못했다) · `canSubmit` · `normalized`(서버로 갈 값) · `touch()`.
 * 서버에서 먼저 불리지 않는다(서버 렌더 · 하이드레이션 중에는 묻지 않고 「확인하는 중」으로 시작한다).
 */
export function useLoginIdAvailability({
  api,
  value,
  rules,
}: UseLoginIdAvailabilityOptions): LoginIdCheck {
  const [checker] = useState(() =>
    createLoginIdChecker({ check: (normalized) => api.checkLoginId(normalized) }),
  )
  useEffect(() => {
    checker.replaceCheck((normalized) => api.checkLoginId(normalized))
  }, [checker, api])
  const answers = useSyncExternalStore(checker.subscribe, checker.getAnswers, () => NO_ANSWERS)
  const [touched, setTouched] = useState(false)
  const touch = useCallback(() => setTouched(true), [])

  const markTaken = useCallback((normalized: string) => checker.markTaken(normalized), [checker])

  const state = loginIdCheckState({ value, rules, answers, touched })
  const ask = state.status !== 'invalid' ? state.normalized : null
  useEffect(() => {
    if (ask === null) checker.cancel()
    else checker.request(ask)
  }, [checker, ask])
  useEffect(() => () => checker.cancel(), [checker])

  return { ...state, touch, markTaken }
}
