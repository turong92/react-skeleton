import type { ApiClient } from '@skeleton/api-client'
import type { Coupon, CouponTab } from '../types'

export type CouponApi = {
  /** `GET {coupons}?status=AVAILABLE|PAST` */
  listCoupons(tab: CouponTab): Promise<Coupon[]>
  /** `POST {coupons}/redeem {code}` → 201 쿠폰. 400 `COUPON.CODE_INVALID` · 409 `COUPON.CODE_USED` · 409 `COUPON.CODE_EXHAUSTED` */
  redeemCoupon(code: string): Promise<Coupon>
}

export function createCouponApi(
  client: Pick<ApiClient, 'list' | 'value'>,
  { coupons = '/coupons' }: { coupons?: string } = {},
): CouponApi {
  const base = coupons.replace(/\/+$/, '')
  return {
    listCoupons: (tab) => client.list<Coupon>(base, { params: { status: tab } }),
    redeemCoupon: (code) =>
      client.value<Coupon>(`${base}/redeem`, { method: 'POST', json: { code } }),
  }
}
