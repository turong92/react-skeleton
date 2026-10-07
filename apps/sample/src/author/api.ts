import { createAuthorProfileApi } from '@skeleton/author-profile'
import { apiClient } from '../api/client'

/** 작성자 프로필 — 경로는 백엔드 `modules/author-profile` 이 여는 `/api/v1/author-profiles` 가 기본값 */
export const profileApi = createAuthorProfileApi(apiClient)
