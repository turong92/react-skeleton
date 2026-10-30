import { createReviewsApi } from '@skeleton/reviews'
import { createReviewsAdminApi } from '@skeleton/reviews/admin'
import { apiClient } from '../api/client'

/** 리뷰 호출 - 백엔드 `review` · `review-jdbc` 가 여는 `/api/v1/reviews`. 요약 · 목록 읽기는 서버 `allow-anonymous-read: true` 라 로그인 없이도 열린다 */
export const reviewsApi = createReviewsApi(apiClient)

/** 운영 호출 - `skeleton.review.admin.enabled=true`(이 앱은 켠다) + 권한 `review.moderate` · `review.reply`, 경로 `/api/v1/admin/reviews` */
export const reviewsAdminApi = createReviewsAdminApi(apiClient)
