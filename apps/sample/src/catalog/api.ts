import { createCatalogApi } from '@skeleton/payment'
import { apiClient } from '../api/client'

/** 상품 · 가격 공개 읽기 — 경로는 백엔드 `catalog` 모듈이 여는 `/api/v1/catalog` (`skeleton.catalog.http.enabled=true`) */
export const catalogApi = createCatalogApi(apiClient)

/** 카탈로그가 꺼진 서버(404) · 잠시 안 되는 서버는 오류 토스트 없이 「가격표 자리 숨김」으로 — 방문자가 처음 보는 화면이다 */
export const QUIET_CATALOG = { meta: { quietStatuses: [404, 500, 502, 503, 504] } } as const
