import { ApiRequestError, ErrorCodes, retryAfterSeconds } from '@skeleton/api-client'
import { foldDuration } from './duration'
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
      case ErrorCodes.AUTHOR_PROFILE_RATE_LIMITED: {
        const seconds = retryAfterSeconds(error)
        return {
          where: 'form',
          message: labels.rateLimited(seconds === undefined ? undefined : foldDuration(seconds)),
        }
      }
      case ErrorCodes.AUTHOR_PROFILE_NOT_FOUND:
        return { where: 'form', message: labels.notFound }
    }
  }
  return { where: 'form', message: labels.failed }
}

/**
 * 폼이 제자리에서 말하는 오류인가 — 앱의 전역 토스트가 건너뛰는 데 쓴다. **`AUTHOR_PROFILE.` 코드만**이다:
 * 이름 칸의 400 검증 오류는 닉네임 같은 다른 폼과 같은 모양이라 여기서 가로채지 않는다 — 그것은 앱이 이미 거른다(sample 은 `apps/sample/src/app/errorToast.ts` 의
 * `COMMON.VALIDATION_FAILED` 필터. 다른 앱은 자기 전역 핸들러가 같은 일을 하는지 확인한다). 이 패키지는 뮤테이션에 `meta` 를 싣지 않는다.
 */
export function isAuthorProfileFormError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.apiError.code.startsWith('AUTHOR_PROFILE.')
}

/**
 * 같은 제출을 다시 보낼 때 `Idempotency-Key` 를 그대로 쓸까 — **네트워크 실패(status 0)만**: 요청이 서버에 닿았는데 답을 잃었을 수 있다.
 * 5xx · 4xx 는 서버가 답한 것이라 다음 시도는 새 제출이다(상한 · 이름 겹침이 풀린 뒤 같은 이름을 다시 만들 수 있다). API 오류가 아닌 던짐도 새 키.
 */
export function shouldReuseIdempotencyKey(error: unknown): boolean {
  return error instanceof ApiRequestError && error.apiError.status === 0
}
