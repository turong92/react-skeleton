import { createPushApi } from '@skeleton/push'
import { apiClient } from '../api/client'

/** 웹 푸시 — 경로는 백엔드 `notification-push` 가 여는 `/api/v1/push` 가 기본값 */
export const pushApi = createPushApi(apiClient)
