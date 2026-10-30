import { defaultReviewsLabels, koReviewsLabels, type ReviewsLabels } from '@skeleton/reviews'
import {
  defaultReviewsAdminLabels,
  koReviewsAdminLabels,
  type ReviewsAdminLabels,
} from '@skeleton/reviews/admin'

/** 리뷰 화면의 문구 - 패키지 사전을 언어에 맞게 고른다 */
export const reviewsLabelsFor = (language: 'ko' | 'en'): ReviewsLabels =>
  language === 'ko' ? koReviewsLabels : defaultReviewsLabels

export const reviewsAdminLabelsFor = (language: 'ko' | 'en'): ReviewsAdminLabels =>
  language === 'ko' ? koReviewsAdminLabels : defaultReviewsAdminLabels
