import type { AdminCatalogPrice } from './catalogAdminTypes'

/**
 * 가격 한 줄이 지금 어떤 상태인가 - 운영자가 「왜 이 가격이 안 보이지」를 읽는 말.
 * `current` 지금 팔린다 / `scheduled` 행사가 아직 시작 전 / `ended` 행사가 끝났다 / `covered` 판매 중이지만 행사가에 가려져 있다 / `stopped` 가격을 판매 중지 / `productStopped` 가격은 판매 중이지만 상품이 판매 중지라 아무도 못 산다
 */
export type PriceState =
  | 'current'
  | 'scheduled'
  | 'ended'
  | 'covered'
  | 'stopped'
  | 'productStopped'

export function priceStateOf(
  price: AdminCatalogPrice,
  now: Date,
  productSelling = true,
): PriceState {
  if (price.stoppedAt !== null || !price.selling) return 'stopped'
  if (!productSelling) return 'productStopped'
  if (price.current) return 'current'
  const t = now.getTime()
  if (price.saleStartsAt !== null && new Date(price.saleStartsAt).getTime() > t) return 'scheduled'
  if (price.saleEndsAt !== null && new Date(price.saleEndsAt).getTime() <= t) return 'ended'
  return 'covered'
}
