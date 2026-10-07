import { ApiRequestError } from '@skeleton/api-client'
import type { AuthLabels } from './labels'

/** 닉네임 길이 상한(서버 계약 1..60 **코드 포인트** — 이모지 하나가 1) */
export const DISPLAY_NAME_MAX_LENGTH = 60

/** 가입 화면의 닉네임 칸 — `off` 안 묻는다(기본) · `optional` 묻되 비워도 된다 · `required` 비우면 막힌다 */
export type DisplayNameMode = 'off' | 'optional' | 'required'

/** 새 `displayName` 이 우선, 없으면 옛 `askDisplayName`(true → `optional`) */
export function resolveDisplayNameMode(
  mode: DisplayNameMode | undefined,
  askDisplayName: boolean | undefined,
): DisplayNameMode {
  return mode ?? (askDisplayName ? 'optional' : 'off')
}

/**
 * 닉네임 입력의 문제(없으면 undefined) — 앞뒤 공백을 뗀 뒤 1..60 코드 포인트, `#` · `@` 는 서버 규칙(Pattern)과 같은 문구로 바로 안내한다.
 * 나머지 규칙(보이지 않는 문자 · 예약어)은 서버가 정하고 필드 오류로 돌아온다 — 👩‍💻 같은 조합 이모지는 막지 않는다
 */
export function displayNameProblem(
  value: string,
  mode: DisplayNameMode,
  labels: AuthLabels,
): string | undefined {
  const trimmed = value.trim()
  if ([...trimmed].length > DISPLAY_NAME_MAX_LENGTH)
    return labels.problemDisplayNameTooLong(DISPLAY_NAME_MAX_LENGTH)
  if (/[#@]/.test(trimmed)) return labels.problemDisplayNamePattern
  if (mode === 'required' && trimmed.length === 0) return labels.problemDisplayNameMissing
  return undefined
}

/** 서버의 닉네임 필드 오류(`errors[].field = "displayName"`, 코드 Required · Size · Pattern · Reserved)를 우리 문구로 — 서버의 영어 message 는 보이지 않는다 */
export function displayNameFieldError(error: unknown, labels: AuthLabels): string | undefined {
  if (!(error instanceof ApiRequestError)) return undefined
  const field = error.apiError.errors?.find((e) => e.field === 'displayName')
  if (!field) return undefined
  switch (field.code) {
    case 'Required':
      return labels.problemDisplayNameMissing
    case 'Pattern':
      return labels.problemDisplayNamePattern
    case 'Reserved':
      return labels.problemDisplayNameReserved
    case 'Size':
    default:
      return labels.problemDisplayNameTooLong(DISPLAY_NAME_MAX_LENGTH)
  }
}
