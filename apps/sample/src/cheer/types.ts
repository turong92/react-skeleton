import type { OrderCard, PaymentAmount } from '@skeleton/payment'

/** 응원하기 상품의 종류 — 백엔드 `PaymentCatalog` 의 `itemType`(주문을 만들 때 `itemRef` 와 함께 보낸다) */
export const CHEER_ITEM_TYPE = 'cheer'

/** `GET /cheers/options` 의 한 줄 — 서버가 가진 금액 목록(1,000 · 3,000 · 5,000원). 브라우저는 이 안에서만 고른다 */
export type CheerOption = { itemRef: string; amount: PaymentAmount }

/**
 * `GET /cheers/me` 의 한 줄 — 내 응원 한 건(최신순). `orderId` 가 결제 한 건(`/payments/:id`)의 열쇠다.
 * `status` 는 `PAID` 또는 `REFUNDED`(전액 환불). 일부 환불은 `PAID` 에 `refundedAmount` 만 오른다.
 * `card` 는 계약에 있다(`{ issuer, last4 } | null` — 카드 결제가 아니거나 계정이 지워져 비워졌으면 `null`; 칸 자체가 없으면 옛 서버라 없는 것으로 본다).
 */
export type Cheer = {
  orderId: string
  amount: PaymentAmount
  refundedAmount: number
  status: 'PAID' | 'REFUNDED'
  createdAt: string
  refundedAt: string | null
  card?: OrderCard | null
}

export type CheerListParams = { cursor?: string; size?: number }
