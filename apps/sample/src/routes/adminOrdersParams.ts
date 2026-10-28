import type { AdminOrderFilter } from '@skeleton/payment/admin'

/**
 * 목록 호출의 쿼리. 탈퇴한 계정의 결제를 숨기는 것은 서버의 기본이라 스위치가 켜졌을 때만 `includeErased` 를 보낸다 -
 * 확인 필요(`review`)에서는 서버가 늘 보여 주니 보내지 않는다(스위치도 그 탭에는 없다)
 */
export function ordersParamsOf(review: boolean, filter: AdminOrderFilter, size: number) {
  return {
    ...(review ? { review: true } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.q ? { q: filter.q } : {}),
    ...(filter.settlement ? { settlement: filter.settlement } : {}),
    ...(!review && filter.includeErased ? { includeErased: true } : {}),
    size,
  }
}
