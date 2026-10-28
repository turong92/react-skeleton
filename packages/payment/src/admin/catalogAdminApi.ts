import type { ApiClient } from '@skeleton/api-client'
import type {
  AddCatalogPriceInput,
  AdminCatalogPrice,
  AdminCatalogProduct,
  CreateCatalogProductInput,
  UpdateCatalogProductInput,
} from './catalogAdminTypes'

export type CatalogAdminApi = {
  /** `GET {basePath}/products` - 판매 중지한 상품 · 지난 가격까지 */
  products(): Promise<AdminCatalogProduct[]>
  /** `POST {basePath}/products` → 201. 409 `CATALOG.CODE_TAKEN` · `CATALOG.LEVEL_TAKEN` */
  createProduct(input: CreateCatalogProductInput): Promise<AdminCatalogProduct>
  /** `PUT {basePath}/products/{code}` - 보낸 칸만. 409 `CATALOG.LEVEL_TAKEN` */
  updateProduct(code: string, input: UpdateCatalogProductInput): Promise<AdminCatalogProduct>
  /** `POST {basePath}/products/{code}/prices` → 201. 409 `CATALOG.PRICE_OVERLAP` · 400 `CATALOG.PRICE_INVALID` */
  addPrice(productCode: string, input: AddCatalogPriceInput): Promise<AdminCatalogPrice>
  /** `POST {basePath}/prices/{code}/stop` - 판매 중지. 기존 구독자는 그 가격 그대로다 */
  stopPrice(code: string): Promise<AdminCatalogPrice>
  /** `PATCH {basePath}/prices/{code}` - 행사가가 끝나는 때만 바꾼다(`null` 은 끝 없음) */
  setSaleEnd(code: string, saleEndsAt: string | null): Promise<AdminCatalogPrice>
  /** `PUT {basePath}/prices/{code}/provider-refs/{provider}` - 결제사 가격 id 를 잇는다 */
  setProviderRef(code: string, provider: string, externalId: string): Promise<AdminCatalogPrice>
  /** `DELETE {basePath}/prices/{code}/provider-refs/{provider}` */
  removeProviderRef(code: string, provider: string): Promise<AdminCatalogPrice>
  /** `GET {basePath}/providers` - 가격 id 를 쓰는 켜진 결제사(링크 칸을 그릴지) */
  providers(): Promise<string[]>
}

export type CatalogAdminApiOptions = {
  /** 운영 경로(기본 `/admin/catalog`) - 백엔드 `skeleton.catalog.admin.enabled=true` 와 권한 `catalog.manage` 가 필요하다. 꺼져 있으면 404, 권한이 없으면 403 */
  basePath?: string
}

export function createCatalogAdminApi(
  client: Pick<ApiClient, 'value' | 'list'>,
  { basePath = '/admin/catalog' }: CatalogAdminApiOptions = {},
): CatalogAdminApi {
  const base = basePath.replace(/\/+$/, '')
  const enc = encodeURIComponent
  const refs = (code: string, provider: string) =>
    `${base}/prices/${enc(code)}/provider-refs/${enc(provider)}`
  return {
    products: () => client.list<AdminCatalogProduct>(`${base}/products`),
    createProduct: (input) =>
      client.value<AdminCatalogProduct>(`${base}/products`, { method: 'POST', json: input }),
    updateProduct: (code, input) =>
      client.value<AdminCatalogProduct>(`${base}/products/${enc(code)}`, {
        method: 'PUT',
        json: input,
      }),
    addPrice: (productCode, input) =>
      client.value<AdminCatalogPrice>(`${base}/products/${enc(productCode)}/prices`, {
        method: 'POST',
        json: input,
      }),
    stopPrice: (code) =>
      client.value<AdminCatalogPrice>(`${base}/prices/${enc(code)}/stop`, { method: 'POST' }),
    setSaleEnd: (code, saleEndsAt) =>
      client.value<AdminCatalogPrice>(`${base}/prices/${enc(code)}`, {
        method: 'PATCH',
        json: { saleEndsAt },
      }),
    setProviderRef: (code, provider, externalId) =>
      client.value<AdminCatalogPrice>(refs(code, provider), {
        method: 'PUT',
        json: { externalId },
      }),
    removeProviderRef: (code, provider) =>
      client.value<AdminCatalogPrice>(refs(code, provider), { method: 'DELETE' }),
    providers: () => client.list<string>(`${base}/providers`),
  }
}
