import type { Order } from '@skeleton/payment'
import type { Cheer } from './types'

/**
 * 응원 기록을 결제 내역 부품(`OrderList`)이 그리는 모양으로 옮긴다. 상태는 서버가 일부 환불을 따로 두지 않으므로(전액 환불일 때만 `REFUNDED`)
 * `PAID` 인데 환불된 금액이 있으면 「일부 환불됨」으로 읽는다. 목록에 없는 칸(결제 수단 · 열린 환불)은 비워 둔다 — 한 건 화면이 서버의 주문을 그대로 보인다.
 */
export function cheerAsOrder(cheer: Cheer, orderName: string): Order {
  const refunded = cheer.status === 'REFUNDED'
  const status: Order['status'] = refunded
    ? 'REFUNDED'
    : cheer.refundedAmount > 0
      ? 'PARTIALLY_REFUNDED'
      : 'PAID'
  const card = cheer.card ?? null
  return {
    id: cheer.orderId,
    status,
    kind: 'ONE_TIME',
    itemType: 'cheer',
    itemRef: '',
    quantity: 1,
    orderName,
    amount: cheer.amount,
    refundedAmount: cheer.refundedAmount,
    refundableAmount: refunded ? 0 : Math.max(cheer.amount.amount - cheer.refundedAmount, 0),
    refundPending: false,
    openRefundStatus: null,
    method: card ? 'CARD' : null,
    card,
    testMode: false,
    failureCode: null,
    createdAt: cheer.createdAt,
    paidAt: cheer.createdAt,
    fulfilled: true,
  }
}
