/*
 * 로그인 아이디 규칙 — 백엔드 `LoginIds`(kotlin-skeleton 설계 §4)와 같은 판정이다. 서버가 늘 다시 판정하므로 이 함수는 **빨리 알려 주는** 용도다.
 * 정규화(앞뒤 공백 제거 + 소문자) 한 값이 `^[a-z0-9]+([._-][a-z0-9]+)*$`, 길이 min~max, 영문 하나 이상이어야 한다.
 * 예약어 · 이미 쓰는 아이디는 서버만 안다(실시간 확인 `checkLoginId` 가 답한다).
 */

/** `GET /auth/methods` 의 `loginId: { minLength, maxLength }` */
export type LoginIdRules = { minLength: number; maxLength: number }

/**
 * 문제의 종류 — 문구를 고르는 기준.
 * `missing` 없음 · `size` 길이 · `chars` 쓸 수 없는 글자(`@` · 공백 · 한글 · 전각 …) · `symbols` 맨 앞뒤 기호 또는 연달아 온 기호 · `digitsOnly` 숫자만
 */
export type LoginIdProblem = 'missing' | 'size' | 'chars' | 'symbols' | 'digitsOnly'

/** 서버가 필드 오류와 실시간 확인에 싣는 코드 */
export type LoginIdServerCode = 'Required' | 'Size' | 'Pattern'

/** 앞뒤 공백을 떼고 소문자로 — 글자를 고쳐 주지는 않는다(전각 · 한글은 그대로 두어 거절된다) */
export function normalizeLoginId(value: string): string {
  return value.trim().toLowerCase()
}

const ALLOWED = /^[a-z0-9._-]+$/
const SHAPE = /^[a-z0-9]+([._-][a-z0-9]+)*$/

/**
 * 문제가 없으면 undefined. 여럿이 겹치면 하나만 돌려준다: 없음 → 쓸 수 없는 글자 → 길이 → 기호 자리 → 숫자만
 * (`1234` 는 길이가 맞으면 「숫자만」, `12` 는 「길이」 — 입력하는 동안 가장 먼저 고칠 것을 말한다)
 */
export function loginIdProblem(value: string, rules: LoginIdRules): LoginIdProblem | undefined {
  const id = normalizeLoginId(value)
  if (id.length === 0) return 'missing'
  if (!ALLOWED.test(id)) return 'chars'
  if (id.length < rules.minLength || id.length > rules.maxLength) return 'size'
  if (!SHAPE.test(id)) return 'symbols'
  if (!/[a-z]/.test(id)) return 'digitsOnly'
  return undefined
}

/** 같은 종류의 문제에 서버가 쓰는 코드 — 맨 앞뒤 · 연속 기호 · 숫자만은 모두 `Pattern` */
export function loginIdServerCode(problem: LoginIdProblem): LoginIdServerCode {
  if (problem === 'missing') return 'Required'
  return problem === 'size' ? 'Size' : 'Pattern'
}
