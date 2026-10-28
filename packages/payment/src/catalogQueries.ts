import { useQuery } from '@tanstack/react-query'
import type { CatalogApi } from './catalogApi'
import type { CatalogKind } from './catalogTypes'
import { paymentKeys } from './queries'

export function catalogProductsQuery(api: CatalogApi, kind?: CatalogKind) {
  return { queryKey: paymentKeys.catalogProducts(kind), queryFn: () => api.products(kind) }
}

/**
 * 판매 중인 상품 · 이 요청 통화의 지금 가격. 가격표(랜딩) · 구독 화면이 같은 표를 읽는다 -
 * 서버가 `Cache-Control: private, max-age=60` 으로 준다(행사가 바뀌는 때는 분 단위로 맞는다).
 * `options.meta` 는 앱의 쿼리 오류 처리에 넘기는 표지(예: 꺼진 서버의 404 를 토스트 없이), `enabled: false` 면 읽지 않는다
 */
export function useCatalogProducts(
  api: CatalogApi,
  kind?: CatalogKind,
  options?: { meta?: Record<string, unknown>; enabled?: boolean },
) {
  return useQuery({ ...catalogProductsQuery(api, kind), ...options })
}
