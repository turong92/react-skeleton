import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'

/** 6자리 코드를 낸 뒤 서버의 답을 화면이 가르는 모양 */
export type CodeFailure =
  | { kind: 'invalid'; attemptsLeft: number | undefined }
  | { kind: 'expired' }
  | { kind: 'rate-limited' }
  | { kind: 'other' }

export function codeFailureOf(error: unknown): CodeFailure {
  if (!(error instanceof ApiRequestError)) return { kind: 'other' }
  const { code, status, data } = error.apiError
  if (code === ErrorCodes.ACCOUNT_CODE_INVALID) {
    const left = (data as { attemptsLeft?: unknown } | undefined)?.attemptsLeft
    return { kind: 'invalid', attemptsLeft: typeof left === 'number' ? left : undefined }
  }
  if (code === ErrorCodes.ACCOUNT_CODE_EXPIRED) return { kind: 'expired' }
  if (status === 429) return { kind: 'rate-limited' }
  return { kind: 'other' }
}
