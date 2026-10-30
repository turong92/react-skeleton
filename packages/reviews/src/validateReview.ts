import type { ReviewsLabels } from './labels'
import type { Rating, ReviewConfig } from './types'

export type ReviewDraft = { rating: Rating | null; body: string }
export type ReviewProblems = { rating?: string; body?: string }

/** 서버와 같은 잣대 - 본문은 앞뒤를 다듬은 길이로 센다(서버는 HTML 을 해석하지 않고 제어 문자만 지운다) */
export function validateReview(
  draft: ReviewDraft,
  config: Pick<ReviewConfig, 'bodyMinLength' | 'bodyMaxLength'>,
  labels: ReviewsLabels['form'],
): ReviewProblems {
  const problems: ReviewProblems = {}
  if (draft.rating === null) problems.rating = labels.ratingRequired
  const length = draft.body.trim().length
  if (length < config.bodyMinLength) problems.body = labels.bodyTooShort(config.bodyMinLength)
  else if (length > config.bodyMaxLength) problems.body = labels.bodyTooLong(config.bodyMaxLength)
  return problems
}
