import { ApiRequestError } from '@skeleton/api-client'
import type { ReviewsAdminLabels } from './labels'

/** 운영 호출의 실패를 한 문장으로 */
export function adminErrorMessage(error: unknown, labels: ReviewsAdminLabels): string {
  if (!(error instanceof ApiRequestError)) return labels.errors.generic
  const { status } = error.apiError
  if (status === 403) return labels.errors.forbidden
  if (status === 404) return labels.errors.notFound
  if (status === 400) return labels.errors.validation
  return labels.errors.generic
}

/** 목록 호출의 404 — 모듈의 `admin.enabled` 가 꺼진 서버 */
export const isToolOff = (error: unknown) =>
  error instanceof ApiRequestError && error.apiError.status === 404
