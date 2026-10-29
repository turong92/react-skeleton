import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import type { RewardsAdminLabels } from './labels'
import { defaultRewardsAdminLabels } from './labels.admin.en'

export function mergeAdminLabels(given?: Partial<RewardsAdminLabels>): RewardsAdminLabels {
  const base = defaultRewardsAdminLabels
  if (!given) return base
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(given)) {
    const original = (base as Record<string, unknown>)[key]
    out[key] =
      typeof original === 'object' && original !== null && typeof value === 'object'
        ? { ...original, ...value }
        : value
  }
  return out as RewardsAdminLabels
}

/** 운영 호출의 실패를 한 문장으로 - `POINT.INSUFFICIENT` 는 잔액 문구, 404 는 꺼진 도구(또는 없는 항목) */
export function adminErrorMessage(error: unknown, labels: RewardsAdminLabels): string {
  if (!(error instanceof ApiRequestError)) return labels.errors.generic
  const { code, status } = error.apiError
  if (code === ErrorCodes.POINT_INSUFFICIENT) return labels.errors.insufficient
  if (code === ErrorCodes.BADGE_CODE_TAKEN) return labels.errors.codeTaken
  if (code === ErrorCodes.BADGE_ARCHIVED) return labels.errors.badgeArchived
  if (code === ErrorCodes.COUPON_ISSUE_CLOSED) return labels.errors.issueClosed
  if (code === ErrorCodes.COUPON_DEFINITION_INVALID) return labels.errors.definitionInvalid
  if (code === ErrorCodes.COMMON_VALIDATION_FAILED || status === 400)
    return labels.errors.validation
  if (status === 404) return labels.errors.notFound
  return labels.errors.generic
}

/** 이 오류가 「도구가 꺼졌다」(목록 호출의 404) - 모듈의 `admin.enabled` 가 꺼진 서버 */
export const isToolOff = (error: unknown) =>
  error instanceof ApiRequestError && error.apiError.status === 404
