import type { AdminCatalogPrice } from './catalogAdminTypes'

/**
 * 가격 한 줄이 지금 어떤 상태인가 - 운영자가 「왜 이 가격이 안 보이지」를 읽는 말.
 * `current` 지금 팔린다 / `scheduled` 행사가 아직 시작 전 / `ended` 행사가 끝났다 / `covered` 판매 중이지만 행사가에 가려져 있다 / `stopped` 판매 중지
 */
export type PriceState = 'current' | 'scheduled' | 'ended' | 'covered' | 'stopped'

export function priceStateOf(price: AdminCatalogPrice, now: Date): PriceState {
  if (price.stoppedAt !== null || !price.selling) return 'stopped'
  if (price.current) return 'current'
  const t = now.getTime()
  if (price.saleStartsAt !== null && new Date(price.saleStartsAt).getTime() > t) return 'scheduled'
  if (price.saleEndsAt !== null && new Date(price.saleEndsAt).getTime() <= t) return 'ended'
  return 'covered'
}
