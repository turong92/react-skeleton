import { createCatalogAdminApi } from '@skeleton/payment/admin'
import { apiClient } from '../api/client'

/** 운영 카탈로그 — 백엔드 `skeleton.catalog.admin.enabled=true`(이 앱은 켠다)와 권한 `catalog.manage` 가 필요하다. 경로는 `/api/v1/admin/catalog` */
export const catalogAdminApi = createCatalogAdminApi(apiClient)
