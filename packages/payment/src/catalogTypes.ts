/** 상품 종류 — 구독 상품은 주기가 있는 가격, 단건 상품은 주기 없는 가격 */
export type CatalogKind = 'SUBSCRIPTION' | 'ONE_TIME'

/** 판매 중인 가격 하나 — `amount` 는 통화 최소 단위(KRW 원 · USD 센트). `code` 가 구독 플랜 코드 · 단건 `itemRef` 와 같다 */
export type CatalogPrice = {
  code: string
  /** ISO-8601 주기(`P1M` · `P1Y`), 단건이면 `null` */
  period: string | null
  amount: number
  currency: string
  /** 행사 중이면 정가 */
  compareAtAmount: number | null
  /** 행사가가 끝나는 때(ISO-8601) */
  saleEndsAt: string | null
}

export type CatalogProductText = { name: string; description: string | null }

export type CatalogProduct = {
  code: string
  kind: CatalogKind
  /** 구독 등급(높을수록 위), 단건이면 `null` */
  level: number | null
  highlighted: boolean
  sortOrder: number
  /** 언어(`ko` · `en`)별 이름 · 설명 */
  texts: Record<string, CatalogProductText>
  /** 이 요청 통화의 지금 가격만 */
  prices: CatalogPrice[]
}

/** `GET /catalog/products` — `currency` 는 서버가 방문 나라로 정한 통화(상품마다 기본 통화로 보여 주는 경우 `null`) */
export type Catalog = {
  currency: string | null
  products: CatalogProduct[]
}
