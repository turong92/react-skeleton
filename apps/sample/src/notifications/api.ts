import { createNotificationsApi } from '@skeleton/notifications'
import { apiClient } from '../api/client'

/** 받은편지함 — 경로는 백엔드 `modules/notification` 이 여는 `/api/v1/notifications` 가 기본값 */
export const notificationsApi = createNotificationsApi(apiClient)
