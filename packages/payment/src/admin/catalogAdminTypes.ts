import type { CatalogKind, CatalogProductText } from '../catalogTypes'

/** 운영자가 보는 가격 한 줄 - 지난 가격까지. 금액은 통화 최소 단위(KRW 원 · USD 센트) */
export type AdminCatalogPrice = {
  code: string
  /** ISO-8601 주기(`P1M` · `P1Y`), 단건이면 `null` */
  period: string | null
  amount: number
  currency: string
  /** 행사 중이면 정가 */
  compareAtAmount: number | null
  saleStartsAt: string | null
  saleEndsAt: string | null
  /** 판매 중지하지 않았다 */
  selling: boolean
  /** 지금 살 수 있는 가격이다(같은 (상품, 주기, 통화) 에서 행사 중이면 행사가만) */
  current: boolean
  stoppedAt: string | null
  /** 결제사 가격 id - `{ paddle: 'pri_…' }` */
  providerRefs: Record<string, string>
}

export type AdminCatalogProduct = {
  code: string
  kind: CatalogKind
  level: number | null
  highlighted: boolean
  selling: boolean
  sortOrder: number
  texts: Record<string, CatalogProductText>
  createdAt: string
  updatedAt: string
  /** 최신 먼저 */
  prices: AdminCatalogPrice[]
}

/** `POST /admin/catalog/products` - 종류와 코드는 만들 때만 정한다 */
export type CreateCatalogProductInput = {
  code: string
  kind: CatalogKind
  level?: number
  highlighted?: boolean
  sortOrder?: number
  texts: Record<string, CatalogProductText>
}

/** `PUT /admin/catalog/products/{code}` - 보낸 칸만 바뀐다(`kind` 는 못 바꾼다) */
export type UpdateCatalogProductInput = {
  level?: number
  highlighted?: boolean
  selling?: boolean
  sortOrder?: number
  texts?: Record<string, CatalogProductText>
}

/** `POST /admin/catalog/products/{code}/prices` - 가격 줄은 고치지 않고 새 줄을 더한다 */
export type AddCatalogPriceInput = {
  /** 비우면 서버가 정한다 */
  code?: string
  period?: string
  amount: number
  currency: string
  compareAtAmount?: number
  saleStartsAt?: string
  saleEndsAt?: string
}
