import { createAdminRolesApi } from '@skeleton/auth/admin'
import { apiClient } from '../api/client'

/** 역할 관리 호출 - 백엔드 `authz` 모듈(`skeleton.authz.admin.enabled=true`, 이 앱은 켠다) */
export const adminRolesApi = createAdminRolesApi(apiClient)
