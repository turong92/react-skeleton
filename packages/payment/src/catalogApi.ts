import type { ApiClient } from '@skeleton/api-client'
import type { Catalog, CatalogKind } from './catalogTypes'

export type CatalogApi = {
  /** `GET {basePath}/products?kind=` - 로그인 없이. 판매 중인 상품 · 이 요청 통화의 지금 가격만. 꺼진 서버는 404 */
  products(kind?: CatalogKind): Promise<Catalog>
}

export type CatalogApiOptions = {
  /** 공개 읽기 경로(기본 `/catalog`) */
  basePath?: string
}

/** 백엔드 `catalog` 모듈의 공개 읽기(`skeleton.catalog.http.enabled=true`) */
export function createCatalogApi(
  client: Pick<ApiClient, 'value'>,
  { basePath = '/catalog' }: CatalogApiOptions = {},
): CatalogApi {
  const base = basePath.replace(/\/+$/, '')
  return {
    products: (kind) =>
      client.value<Catalog>(`${base}/products`, kind ? { params: { kind } } : undefined),
  }
}
