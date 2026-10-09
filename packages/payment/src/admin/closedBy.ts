import type { AdminRefund } from './types'

/**
 * `WITHDRAWN` 줄을 누가 닫았나. 백엔드는 운영자 응답에도 `closedBy` 를 늘 보낸다(계약 1.2 · 1.5) - 그 칸만 읽는다.
 * `SYSTEM` 이면 환불이 끝나 요청을 시스템이 닫은 것, 그 밖(`USER` · `null`)은 본인이 거둔 것이다. 이유 코드(`ORDER_REFUNDED`)로 짐작하지 않는다
 */
export function closedByOf(refund: Pick<AdminRefund, 'closedBy'>): 'USER' | 'SYSTEM' {
  return refund.closedBy === 'SYSTEM' ? 'SYSTEM' : 'USER'
}
