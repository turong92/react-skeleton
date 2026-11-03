import { createBroadcastAdminApi } from '@skeleton/notifications/admin'
import { apiClient } from '../api/client'

/** 공지 발송 운영 호출 - 백엔드 `notification-broadcast`(`skeleton.notification.broadcast.admin.enabled=true`, 이 앱은 켠다), 경로 `/api/v1/admin/broadcasts` */
export const broadcastAdminApi = createBroadcastAdminApi(apiClient)
