import { createDashboardApi } from '@skeleton/dashboard'
import { apiClient } from '../api/client'

/** 관리자 대시보드 호출 - 백엔드 `modules/dashboard`(`skeleton.dashboard.admin.enabled=true`, 이 앱은 켠다), 경로는 `/api/v1/admin/dashboard` */
export const dashboardApi = createDashboardApi(apiClient)
