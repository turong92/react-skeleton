import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import type { PasswordPolicy, PasswordViolation } from './types'

export type PasswordRequirement = { code: PasswordViolation; met: boolean }

/** 서버 `PasswordPolicy` 의 `MIN_LOCAL_PART` — 이메일 앞부분이 이보다 짧으면 비교하지 않는다 */
const MIN_LOCAL_PART = 3

const utf8Bytes = (value: string) => new TextEncoder().encode(value).length

/**
 * 비밀번호가 정책의 각 항목을 지키는지(서버 `PasswordPolicy.check` 와 같은 규칙) — 켜 둔 규칙만 순서대로 돌려준다.
 * 길이는 글자 수, 상한은 UTF-8 바이트 수. 화면은 `code` 마다 문구를 고른다(백엔드 `TOO_COMMON` · `BREACHED` 는 서버만 안다).
 */
export function passwordRequirements(
  policy: PasswordPolicy,
  password: string,
  email?: string | null,
): PasswordRequirement[] {
  const list: PasswordRequirement[] = [
    { code: 'TOO_SHORT', met: [...password].length >= policy.minLength },
  ]
  if (policy.requireLetter) list.push({ code: 'NEEDS_LETTER', met: /\p{L}/u.test(password) })
  if (policy.requireDigit) list.push({ code: 'NEEDS_DIGIT', met: /\p{Nd}/u.test(password) })
  if (policy.requireSymbol)
    list.push({ code: 'NEEDS_SYMBOL', met: /[^\p{L}\p{Nd}\s]/u.test(password) })
  if (policy.forbidEmailLocalPart) {
    const local = (email ?? '').split('@')[0]?.toLowerCase() ?? ''
    list.push({
      code: 'CONTAINS_EMAIL',
      met: local.length < MIN_LOCAL_PART || !password.toLowerCase().includes(local),
    })
  }
  list.push({ code: 'TOO_LONG', met: utf8Bytes(password) <= policy.maxBytes })
  return list
}

/**
 * 막대 한 칸 수(0~4). 길이 · 글자 종류의 가벼운 추정일 뿐 — 서버의 흔한 비밀번호 · 유출 검사를 대신하지 않는다.
 * 정책 최소 길이에 못 미치면 2 를 넘지 않는다(통과 못 할 비밀번호를 「강함」이라 하지 않는다).
 */
export function passwordStrength(password: string, policy: PasswordPolicy): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0
  const length = [...password].length
  const kinds = [/\p{Ll}/u, /\p{Lu}/u, /\p{Nd}/u, /[^\p{L}\p{Nd}]/u].filter((re) =>
    re.test(password),
  ).length
  const lengthScore = length >= 20 ? 3 : length >= 14 ? 2 : length >= 10 ? 1 : 0
  let score = Math.min(4, 1 + lengthScore + (kinds >= 3 ? 1 : 0) - (kinds <= 1 ? 1 : 0))
  if (length >= 16 && kinds >= 3) score = 4
  if (length < policy.minLength) score = Math.min(score, 2)
  if (length < 6) score = Math.min(score, 1)
  return Math.max(1, score) as 1 | 2 | 3 | 4
}

/** `ACCOUNT.PASSWORD_POLICY` 의 `data.violations` — 다른 에러 · 깨진 data 면 빈 배열 */
export function violationsOf(error: unknown): PasswordViolation[] {
  if (!(error instanceof ApiRequestError)) return []
  if (error.apiError.code !== ErrorCodes.ACCOUNT_PASSWORD_POLICY) return []
  const data = error.apiError.data
  if (typeof data !== 'object' || data === null) return []
  const violations = (data as { violations?: unknown }).violations
  return Array.isArray(violations)
    ? violations.filter((v): v is PasswordViolation => typeof v === 'string')
    : []
}
