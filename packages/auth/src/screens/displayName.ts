import type { AuthLabels } from './labels'

/** 닉네임 길이 상한(서버 계약 1..60) */
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

/** 닉네임 입력의 문제(없으면 undefined) — 앞뒤 공백을 뗀 뒤 1..60자 */
export function displayNameProblem(
  value: string,
  mode: DisplayNameMode,
  labels: AuthLabels,
): string | undefined {
  const trimmed = value.trim()
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH)
    return labels.problemDisplayNameTooLong(DISPLAY_NAME_MAX_LENGTH)
  if (mode === 'required' && trimmed.length === 0) return labels.problemDisplayNameMissing
  return undefined
}
