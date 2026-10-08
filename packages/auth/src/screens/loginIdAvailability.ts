import {
  loginIdProblem,
  normalizeLoginId,
  type LoginIdProblem,
  type LoginIdRules,
} from '../account/loginIdRules'
import type { LoginIdAvailability } from '../account/types'

/*
 * 아이디 실시간 확인의 핵심 — React 를 모르는 두 조각이다(가짜 시계로 시험한다). 훅 `useLoginIdAvailability` 가 이 둘을 화면에 잇는다.
 *  - `createLoginIdChecker`: 입력이 멈춘 뒤 0.4초에 한 번 묻고, 값이 바뀌면 늦게 온 답을 버리고, 같은 값을 다시 묻지 않는다.
 *  - `loginIdCheckState`: 값 · 규칙 · 지금까지 받은 답에서 다섯 상태(형식 안 맞음 · 확인하는 중 · 쓸 수 있다 · 쓸 수 없다 · 확인하지 못했다)를 뽑는다.
 */

/** 입력이 멈춘 뒤 묻기까지 기다리는 시간 */
export const LOGIN_ID_CHECK_DELAY_MS = 400

/** 서버의 답 하나 — `unknown` 은 답을 못 받은 것(429 · 네트워크 · 그 밖의 실패): 거절이 아니다 */
export type LoginIdAnswer = 'available' | 'taken' | 'unknown'
/** 정규화한 아이디 → 받은 답 */
export type LoginIdAnswers = Readonly<Record<string, LoginIdAnswer>>

export type LoginIdChecker = {
  /** 정규화한 값을 확인해 달라고 한다 — 이전 요청은 접힌다(기다리던 것은 취소, 날아간 것은 답을 버림) */
  request(normalized: string): void
  /** 기다리던 것도 날아간 것도 접는다(형식이 틀려졌거나 화면이 닫힐 때) */
  cancel(): void
  /** 서버가 내는 순간 「쓸 수 없다」(409 `LOGIN_ID_TAKEN`)고 했다 - 앞서 받은 「쓸 수 있다」를 덮어쓰고 같은 값은 다시 묻지 않는다 */
  markTaken(normalized: string): void
  /** 묻는 함수를 바꾼다(부모가 새 api 를 넘겼을 때) — 받아 둔 답은 그대로 */
  replaceCheck(next: (normalized: string) => Promise<LoginIdAvailability>): void
  getAnswers(): LoginIdAnswers
  subscribe(listener: () => void): () => void
}

export function createLoginIdChecker(options: {
  check: (normalized: string) => Promise<LoginIdAvailability>
  delayMs?: number
}): LoginIdChecker {
  const { delayMs = LOGIN_ID_CHECK_DELAY_MS } = options
  let check = options.check
  let answers: LoginIdAnswers = {}
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  const listeners = new Set<() => void>()

  const cancel = () => {
    generation += 1
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const store = (normalized: string, answer: LoginIdAnswer) => {
    answers = { ...answers, [normalized]: answer }
    listeners.forEach((listener) => listener())
  }

  return {
    request(normalized) {
      cancel()
      const known = answers[normalized]
      // 「쓸 수 있다」 「쓸 수 없다」는 다시 묻지 않는다. 「모름」은 다시 와 주면 다시 묻는다
      if (known === 'available' || known === 'taken') return
      const mine = generation
      timer = setTimeout(() => {
        timer = undefined
        check(normalized).then(
          (result) => {
            if (mine === generation) store(normalized, result.available ? 'available' : 'taken')
          },
          () => {
            if (mine === generation) store(normalized, 'unknown')
          },
        )
      }, delayMs)
    },
    cancel,
    markTaken(normalized) {
      store(normalized, 'taken')
    },
    replaceCheck(next) {
      check = next
    },
    getAnswers: () => answers,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export type LoginIdStatus = 'invalid' | 'checking' | 'available' | 'taken' | 'unknown'

export type LoginIdCheckState = {
  status: LoginIdStatus
  /** `status === 'invalid'` 일 때 무엇이 틀렸나 */
  problem?: LoginIdProblem
  /** 서버로 갈 모양(앞뒤 공백 제거 + 소문자) */
  normalized: string
  /** 내도 되나 — 형식이 맞고 「쓸 수 없다」가 아니면 된다(확인 중 · 확인 못 함도 서버가 판정하므로 낸다) */
  canSubmit: boolean
  /** 칸 옆 오류로 보여야 하나 — 형식 오류는 칸을 벗어났거나 내려 한 뒤부터, 「쓸 수 없다」는 바로 */
  showError: boolean
  /** 「쓸 수 있다」인데 입력한 글자와 저장될 글자가 다르다(대문자) — 「… (으)로 저장돼요」를 덧붙인다 */
  savedAsNormalized: boolean
}

export function loginIdCheckState(input: {
  value: string
  rules: LoginIdRules
  answers: LoginIdAnswers
  touched: boolean
}): LoginIdCheckState {
  const { value, rules, answers, touched } = input
  const normalized = normalizeLoginId(value)
  const problem = loginIdProblem(value, rules)
  if (problem) {
    return {
      status: 'invalid',
      problem,
      normalized,
      canSubmit: false,
      showError: touched,
      savedAsNormalized: false,
    }
  }
  const status: LoginIdStatus = answers[normalized] ?? 'checking'
  return {
    status,
    normalized,
    canSubmit: status !== 'taken',
    showError: status === 'taken',
    savedAsNormalized: status === 'available' && value.trim() !== normalized,
  }
}
