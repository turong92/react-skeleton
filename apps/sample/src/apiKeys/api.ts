import { createAdminApiKeysApi } from '@skeleton/auth/admin'
import { createApiKeysApi } from '@skeleton/auth/api-keys'
import { apiClient } from '../api/client'

/** 내 API 키 호출 - 백엔드 `api-key` 모듈(`skeleton.api-key.http.enabled=true`, 이 앱은 켠다) */
export const apiKeysApi = createApiKeysApi(apiClient)

/** 운영자 API 키 호출 - 백엔드 `skeleton.api-key.admin.enabled=true`(이 앱은 켠다) + `api-key.read` / `api-key.revoke` */
export const adminApiKeysApi = createAdminApiKeysApi(apiClient)
