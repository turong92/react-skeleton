import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import type { BroadcastAdminLabels } from './labels'
import { defaultBroadcastAdminLabels } from './labels.en'

export function mergeBroadcastLabels(given?: Partial<BroadcastAdminLabels>): BroadcastAdminLabels {
  const base = defaultBroadcastAdminLabels
  if (!given) return base
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(given)) {
    const original = (base as Record<string, unknown>)[key]
    out[key] =
      typeof original === 'object' && original !== null && typeof value === 'object'
        ? { ...original, ...value }
        : value
  }
  return out as BroadcastAdminLabels
}

/** 운영 호출의 실패를 한 문장으로 - 서버 코드마다 문구가 있고, 나머지는 상태 코드로 */
export function broadcastErrorMessage(error: unknown, labels: BroadcastAdminLabels): string {
  if (!(error instanceof ApiRequestError)) return labels.errors.generic
  const { code, status } = error.apiError
  const t = labels.errors
  const byCode: Record<string, string> = {
    [ErrorCodes.BROADCAST_NOT_FOUND]: t.notFound,
    [ErrorCodes.BROADCAST_INVALID_STATE]: t.invalidState,
    [ErrorCodes.BROADCAST_UNKNOWN_TYPE]: t.unknownType,
    [ErrorCodes.BROADCAST_UNKNOWN_CHANNEL]: t.unknownChannel,
    [ErrorCodes.BROADCAST_UNKNOWN_AUDIENCE]: t.unknownAudience,
    [ErrorCodes.BROADCAST_INVALID_AUDIENCE]: t.invalidAudience,
    [ErrorCodes.BROADCAST_INVALID_LINK]: t.invalidLink,
    [ErrorCodes.BROADCAST_INVALID_SCHEDULE]: t.invalidSchedule,
    [ErrorCodes.BROADCAST_TEST_TOO_SOON]: t.testTooSoon,
  }
  const known = byCode[code]
  if (known) return known
  if (status === 403) return t.forbidden
  if (status === 404) return t.notFound
  if (status === 400 || code === ErrorCodes.COMMON_VALIDATION_FAILED) return t.validation
  return t.generic
}

/** 이 오류가 「도구가 꺼졌다」(조회의 404) - 모듈의 `admin.enabled` 가 꺼진 서버 */
export const isToolOff = (error: unknown) =>
  error instanceof ApiRequestError && error.apiError.status === 404
