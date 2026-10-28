import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rewardsRoot } from '../queryKeys'
import type { CouponTab } from '../types'
import type { CouponApi } from './couponApi'

export const couponKeys = {
  all: [...rewardsRoot, 'coupons'] as const,
  list: (tab: CouponTab) => [...couponKeys.all, tab] as const,
}

/** 쿠폰함 — `AVAILABLE` 은 쓸 수 있는 것, `PAST` 는 쓴 · 끝난 것. `enabled: false` 면 가져오지 않는다 */
export function useCoupons(
  api: Pick<CouponApi, 'listCoupons'>,
  tab: CouponTab,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({ queryKey: couponKeys.list(tab), queryFn: () => api.listCoupons(tab), enabled })
}

/** 코드 등록 — 성공하면 쿠폰함을 다시 가져온다. 오류 코드(`COUPON.CODE_*`)는 호출한 쪽이 `onError` 로 */
export function useRedeemCoupon(api: Pick<CouponApi, 'redeemCoupon'>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => api.redeemCoupon(code),
    onSuccess: () => client.invalidateQueries({ queryKey: couponKeys.all }),
  })
}
