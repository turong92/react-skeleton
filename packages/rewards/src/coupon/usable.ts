import type { Coupon } from '../types'

export type CouponTarget = {
  /** 단건 결제는 `ONE_TIME`, 구독 시작은 `SUBSCRIPTION` */
  purpose: 'ONE_TIME' | 'SUBSCRIPTION'
  /** 사려는 상품 종류 - 응원하기는 `cheer`, 구독은 `subscription`(서버의 구독 `itemType`). 안 주면 「종류 없음」 */
  itemType?: string
  /** 화면이 보이는 플랜들 - 이 중 하나에라도 맞으면 보인다. 플랜이 없는 결제(단건)는 비워 둔다 - 플랜 코드가 찬 쿠폰은 맞지 않는다 */
  planCodes?: readonly string[]
  /** 지금(ms) - 사용 시작(`usableFrom`)이 이보다 뒤인 쿠폰은 뺀다. 앱은 서버 시계를 준다(서버가 견적 · 예약에서 같은 시계로 판정한다). 안 주면 기기 시계 */
  now?: number
}

/** 서버와 같은 규칙: 쿠폰의 목록이 비면 어디서나, 차 있으면 지금 사려는 값이 들어 있어야 한다(값이 없으면 맞지 않는다) */
const fits = (allowed: readonly string[] | undefined, wanted: readonly string[]) =>
  !allowed || allowed.length === 0 || wanted.some((w) => allowed.includes(w))

/**
 * 결제에 얹어 볼 수 있는 쿠폰만 - 서버의 「사용 가능」 탭에는 다른 결제가 쥐고 있는 쿠폰(`RESERVED`)도 들어 있다.
 * 사용 시작 전 쿠폰은 서버가 「사용 가능」 목록에 넣고 견적 · 예약에서만 거절하므로 여기서 뺀다. 범위(`scope`)는 서버(`CouponDiscountSource.applies`)와 같은 규칙으로 `purposes` · `itemTypes` · `planCodes` 를 본다.
 * `itemRefs` 는 거르지 않는다 - 사용자 쿠폰 응답에 그 칸이 없다. 그런 쿠폰은 보이되 안 맞으면 견적 · 주문이 `PAYMENT.DISCOUNT_NOT_APPLICABLE` 로 말한다.
 */
export function usableCoupons(coupons: readonly Coupon[], target: CouponTarget): Coupon[] {
  const at = target.now ?? Date.now()
  return coupons.filter(
    (coupon) =>
      coupon.status === 'AVAILABLE' &&
      (coupon.usableFrom == null || new Date(coupon.usableFrom).getTime() <= at) &&
      fits(coupon.scope.purposes, [target.purpose]) &&
      fits(coupon.scope.itemTypes, target.itemType === undefined ? [] : [target.itemType]) &&
      fits(coupon.scope.planCodes, target.planCodes ?? []),
  )
}
