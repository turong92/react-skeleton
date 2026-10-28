import type { Coupon } from '../types'

export type CouponTarget = {
  /** 단건 결제는 `ONE_TIME`, 구독 시작은 `SUBSCRIPTION` */
  purpose: 'ONE_TIME' | 'SUBSCRIPTION'
  itemType?: string
  itemRef?: string
  /** 화면이 보이는 플랜들 - 이 중 하나에라도 맞으면 보인다 */
  planCodes?: readonly string[]
}

/** 범위의 한 목록: 비었으면 어디서나, 아니면 `wanted` 중 하나가 들어 있어야 */
const fits = (allowed: readonly string[] | undefined, wanted: readonly string[] | undefined) =>
  !allowed ||
  allowed.length === 0 ||
  wanted === undefined ||
  wanted.some((w) => allowed.includes(w))

/**
 * 결제에 얹어 볼 수 있는 쿠폰만 - 서버의 「사용 가능」 탭에는 다른 결제가 쥐고 있는 쿠폰(`RESERVED`)도 들어 있다.
 * 범위(`scope`)는 서버와 같은 규칙: 목록이 비면 어디서나, 차 있으면 지금 사는 것이 들어 있어야 한다. 최종 판정은 서버(`PAYMENT.DISCOUNT_NOT_APPLICABLE`)
 */
export function usableCoupons(coupons: readonly Coupon[], target: CouponTarget): Coupon[] {
  return coupons.filter(
    (coupon) =>
      coupon.status === 'AVAILABLE' &&
      fits(coupon.scope.purposes, [target.purpose]) &&
      fits(coupon.scope.itemTypes, target.itemType === undefined ? undefined : [target.itemType]) &&
      fits(coupon.scope.itemRefs, target.itemRef === undefined ? undefined : [target.itemRef]) &&
      fits(coupon.scope.planCodes, target.planCodes),
  )
}
