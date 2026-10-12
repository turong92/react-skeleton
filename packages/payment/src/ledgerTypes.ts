import type { PaymentAmount } from './types'

/** 주문 상태 — 전이는 백엔드 장부가 지킨다. 「환불 중」은 상태가 아니라 `refundPending` 이다 */
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMING'
  | 'PAID'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELED'

export type RefundStatus =
  | 'REQUESTED'
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  | 'WITHDRAWN'

/** 열린 환불(아직 끝나지 않은 줄)의 상태 — `REQUESTED` 는 요청만 했고 돈은 움직이지 않았다 · `PENDING` 은 환불이 진행 중이다 */
export type OpenRefundStatus = Extract<RefundStatus, 'REQUESTED' | 'PENDING'>

/** 환불을 만든 쪽 — 본인 요청 · 운영자 · 결제사 콘솔에서 직접 */
export type RefundOrigin = 'USER' | 'OPERATOR' | 'PROVIDER'

/** 본인이 환불 요청에 고를 수 있는 사유(고정 코드 — 자유 문장은 받지 않는다) */
export type RefundRequestReason = 'CUSTOMER_REQUEST' | 'DUPLICATE' | 'NOT_DELIVERED'

/** 카드 결제의 표시용 값 — 카드사 코드(대문자 영문)와 끝 네 글자(숫자 또는 `*`). 각각 `null` 일 수 있다 */
export type OrderCard = { issuer: string | null; last4: string | null }

/** 백엔드 주문 응답. 사용자 응답에는 결제사 이름 · 결제사 결제 번호 · 확인 필요 사유가 없다 */
export type Order = {
  id: string
  status: OrderStatus
  /** 한 번 결제 · 구독의 첫 결제 · 구독의 갱신 결제(계약 §12) */
  kind: 'ONE_TIME' | 'SUBSCRIPTION_INITIAL' | 'SUBSCRIPTION_RENEWAL'
  itemType: string
  itemRef: string
  quantity: number
  orderName: string
  amount: PaymentAmount
  refundedAmount: number
  refundableAmount: number
  /** 열린 환불이 있다 — 새 환불 요청이 안 되는 이유. 요청만 했는지 진행 중인지는 `openRefundStatus` */
  refundPending: boolean
  /**
   * 열린 환불의 상태(없으면 `null`) - 백엔드는 늘 보낸다(계약 1.1).
   * 화면 낱말: `REQUESTED` 「환불 요청함」 · `PENDING` 「환불 중」
   */
  openRefundStatus: OpenRefundStatus | null
  /** 결제 수단 종류 코드(`CARD` · `EASY_PAY` …). 결제되기 전에는 `null` */
  method: string | null
  /** 카드 결제가 아니거나 계정이 지워져 비워졌으면 `null` */
  card: OrderCard | null
  testMode: boolean
  failureCode: string | null
  createdAt: string
  paidAt: string | null
  fulfilled: boolean
}

export type Refund = {
  id: string
  orderId: string
  status: RefundStatus
  amount: PaymentAmount
  reasonCode: string
  origin: RefundOrigin
  requestedAt: string
  completedAt: string | null
  /**
   * `WITHDRAWN` 줄을 누가 닫았나 - `USER` 본인이 거뒀다 · `SYSTEM` 주문이 전액 환불돼 요청이 닫혔다. 다른 상태의 줄은 `null`(계약 1.2).
   * 사용자 응답과 운영자 응답 모두에 온다. `null` 이면 `USER` 로 읽는다
   */
  closedBy: 'USER' | 'SYSTEM' | null
  /**
   * 운영자가 금액을 고쳐 승인했다면 처음 요청한 금액(그때 `amount` 는 승인한 금액이고 둘이 다르다). 고치지 않았으면 `null` - 구버전 서버는 칸이 없다
   */
  requestedAmount?: PaymentAmount | null
}

/** `GET /config` — 결제사 빈이 없거나 클라이언트 키가 없으면 `available: false` */
export type PaymentConfig = {
  available: boolean
  testMode: boolean
  refundRequestsEnabled: boolean
}

/**
 * 결제창에 넘길 값 — 결제사 모듈이 만들고 프론트가 `kind` 로 갈라 연다. 공개해도 되는 값만 담는다.
 * `openCheckout` 이 모르는 `kind` 는 던진다(새 결제사 · 수단이 이 패키지보다 먼저 올 수 있다).
 */
export type TossPaymentWindowCheckout = {
  provider: string
  kind: 'TOSS_PAYMENT_WINDOW'
  /** 결제사 모듈이 정한다 - 없으면 `null`(계약 1.3). `openCheckout` 은 키 없이 결제창을 열지 않고 던진다 */
  clientKey: string | null
  testMode: boolean
  orderId: string
  orderName: string
  amount: PaymentAmount
}
export type Checkout = TossPaymentWindowCheckout

export type CreateOrderInput = { itemType: string; itemRef: string; quantity?: number }
/**
 * `checkout` 은 같은 `Idempotency-Key` 를 다시 보냈는데 주문이 이미 `PENDING` 이 아니거나 결제 가능 시간이 지난 `PENDING` 이면 `null` 이다(`200`, 계약 2 「주문 만들기」) -
 * 열 결제창이 없다. 새 주문(`201`)은 늘 값이 있다
 */
export type CreateOrderResult = { order: Order; checkout: Checkout | null }

/** 결제창에서 돌아온 결제의 승인 요청. `amount` 는 주소에서 왔다 — 서버가 주문의 금액과 대조한다(최소 단위 정수) */
export type ConfirmOrderInput = { providerPaymentId: string; amount: number }

export type OrderDetail = { order: Order; refunds: Refund[] }

export type RefundRequestInput = { reasonCode: RefundRequestReason; amount?: number }

export type OrderListParams = { cursor?: string; size?: number }

/** 쓰기 호출이 쓰는 키. 같은 사용자 의도를 다시 보낼 때만 재사용하고, 주지 않으면 호출마다 새로 만든다 */
export type IdempotentCall = { idempotencyKey?: string }
