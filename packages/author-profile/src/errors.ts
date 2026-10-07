import { ApiRequestError, ErrorCodes, retryAfterSeconds } from '@skeleton/api-client'
import type { AuthorProfileConfig } from './types'
import type { AuthorProfileLabels } from './labels'

/** 서버 이름 칸 오류의 필드 이름(`errors[].field`) */
const NAME_FIELD = 'name'

export type ProfileFormProblem = {
  /** `name` 이면 이름 칸 아래에, `form` 이면 폼 전체에 */
  where: 'name' | 'form'
  message: string
}

/**
 * 이름을 서버에 묻기 전에 알 수 있는 문제 — 앞뒤 공백을 뗀 뒤 비었음 · 상한(코드 포인트) 초과 · `#` `@`.
 * 예약어 · 보이지 않는 문자는 서버가 정하고 칸 오류로 돌아온다.
 */
export function nameProblem(
  value: string,
  labels: AuthorProfileLabels,
  { nameMaxLength }: Pick<AuthorProfileConfig, 'nameMaxLength'>,
): string | undefined {
  const trimmed = value.trim()
  if (trimmed.length === 0) return labels.nameRequired
  if ([...trimmed].length > nameMaxLength) return labels.nameTooLong(nameMaxLength)
  if (/[#@]/.test(trimmed)) return labels.namePattern
  return undefined
}

/**
 * 만들기 · 이름 바꾸기 · 지우기의 서버 답을 폼이 제자리에서 말할 문장으로 — 서버의 영어 문장은 보이지 않는다.
 * 오류가 없으면 undefined. 앱의 전역 오류 토스트는 이 코드들을 따로 빼야 같은 말이 두 번 나오지 않는다(`isAuthorProfileFormError`).
 */
export function profileFormProblem(
  error: unknown,
  labels: AuthorProfileLabels,
  limits: AuthorProfileConfig,
): ProfileFormProblem | undefined {
  if (error === null || error === undefined) return undefined
  if (error instanceof ApiRequestError) {
    const { code, errors } = error.apiError
    const field = errors?.find((e) => e.field === NAME_FIELD)
    if (field) {
      const message: Record<string, string> = {
        Required: labels.nameRequired,
        Pattern: labels.namePattern,
        Reserved: labels.nameReserved,
      }
      return {
        where: 'name',
        message: message[field.code] ?? labels.nameTooLong(limits.nameMaxLength),
      }
    }
    switch (code) {
      case ErrorCodes.AUTHOR_PROFILE_NAME_TAKEN:
        return { where: 'name', message: labels.nameTaken }
      case ErrorCodes.AUTHOR_PROFILE_LIMIT_REACHED:
        return { where: 'form', message: labels.limitReached(limits.maxPerAccount) }
      case ErrorCodes.AUTHOR_PROFILE_RATE_LIMITED:
        return { where: 'form', message: labels.rateLimited(retryAfterSeconds(error)) }
      case ErrorCodes.AUTHOR_PROFILE_NOT_FOUND:
        return { where: 'form', message: labels.notFound }
    }
  }
  return { where: 'form', message: labels.failed }
}

/** 폼이 제자리에서 말하는 오류인가 — 앱의 전역 토스트가 건너뛰는 데 쓴다 */
export function isAuthorProfileFormError(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return false
  const { code, errors } = error.apiError
  return code.startsWith('AUTHOR_PROFILE.') || (errors ?? []).some((e) => e.field === NAME_FIELD)
}
