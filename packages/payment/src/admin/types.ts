import type { Order, OrderStatus, Refund, RefundRequestReason, RefundStatus } from '../ledgerTypes'

/*
 * 운영자 경로의 응답 모양 — 백엔드 계약 문서(`docs/payment-http-contract.md` §1.4 · §1.5 · §1.6 · §3)와 컨트롤러 응답(`PaymentResponses.kt`)에 맞춘 것이다
 * (이 패키지 README 「운영자 API」 표).
 */

/**
 * 확인 필요 사유 — 스펙 §5.1(`review_reason`)과 B3 가 더한 `ORDER_MISMATCH`. 모르는 코드가 와도 화면은 중립 글자로 그린다(그래서 `string`).
 * `FULFILMENT_UNRESOLVED`(돈은 받았는데 지급 작업이 끝내 실패) · `REFUND_APPLY_UNRESOLVED`(환불은 됐는데 회수 작업이 끝내 실패)는 「결제사와 맞추기」가 그 작업을 다시 건다.
 * `STALE_CONFIRMING` · `STALE_REFUND` 는 줄에 찍힌 사유가 없을 때 **파생으로 붙는** 사유다(오래 「결제 확인 중」 · 「환불 중」인 채 남은 줄 - 목록 줄뿐 아니라 한 건 상세와 맞추기 응답에도 온다, 계약 7).
 * 지급 · 회수가 안 끝난 채 오래된 주문은 줄에 사유가 없어도 `FULFILMENT_UNRESOLVED` · `REFUND_APPLY_UNRESOLVED` 로 온다. 파생 사유는 「결제사와 맞추기」를 눌러도 풀리지 않을 수 있다
 */
export type ReviewReason =
  | 'AMOUNT_MISMATCH'
  | 'REFUND_MISMATCH'
  | 'MODE_MISMATCH'
  | 'CONFIRM_UNRESOLVED'
  | 'ORDER_MISMATCH'
  | 'FULFILMENT_UNRESOLVED'
  | 'REFUND_APPLY_UNRESOLVED'
  | 'BUYER_COUNTRY_KR'
  | 'SUBSCRIPTION_STALE_CHARGE'
  | 'SUBSCRIPTION_CANCEL_REFUND_UNRESOLVED'
  | 'STALE_CONFIRMING'
  | 'STALE_REFUND'

/** 운영자 주문 응답 — 사용자 응답(`Order`)에 운영자만 보는 칸을 더한다 */
export type AdminOrder = Order & {
  /**
   * 산 계정. 계정이 지워졌고 백엔드가 `skeleton.payment.erasure.account-id=TOMBSTONE` 이면 `deleted:` 로 시작하는 대체 값이다(`isErasedAccountId`) -
   * 기본 `KEEP` 이면 지워진 계정도 원래 id 그대로라 이 칸으로는 가를 수 없다 - 탈퇴 여부는 `accountErasedAt` 이 말한다
   */
  accountId: string | null
  /** 결제사 이름 */
  provider: string
  /** 결제사의 결제 번호(토스 paymentKey). 결제창을 열고 아직 승인 요청 전이면 `null` */
  providerPaymentId: string | null
  /**
   * 계정이 탈퇴한 시각(없으면 `null`). 백엔드가 늘 보낸다(계약 §1.4). 타입의 `?` 는 방어다 - 없으면 `deleted:` 대체 id 로만 가른다.
   * 「탈퇴한 계정」 표시는 이 칸을 먼저 본다(기본 `KEEP` 모드에서도 가를 수 있다)
   */
  accountErasedAt?: string | null
  /** `null` 이 아니면 사람이 봐야 한다. 「결제사와 맞추기」로 풀리면 `null` 이 된다 */
  reviewReason: string | null
}

/** 운영자 환불 응답 — 사용자 응답(`Refund`)에 운영자 id · 결제사 거절 코드 */
export type AdminRefund = Refund & {
  requestedBy: string | null
  decidedBy: string | null
  /**
   * 줄에 찍히는 이유 코드. 결제사 거절 코드 말고 **우리 코드**도 온다(계약 6.1): `NOT_APPLIED` · `PROVIDER_PENDING` · `RESULT_MISMATCH` ·
   * `ORDER_REFUNDED` · `LATE_RESULT`(닫힌 뒤에 환불됨 응답이 도착했다) · `REFUND_DECLINED`(결제사가 코드 없이 확정 거절)(`SUCCEEDED` 줄에 `RESULT_MISMATCH` 가 남을 수 있다).
   * `PROVIDER_PENDING_EXPIRED` 는 줄에는 안 찍히고 **이력(`providerCode`)에만** 남는다. 화면은 아는 코드를 문장으로, 모르는 코드는 그대로 그린다
   */
  failureCode: string | null
}

/** 이력(`payment_events`) 한 줄 — 「이 결제가 왜 이 상태인가」 */
export type PaymentEvent = {
  /** 그 주문 이력 안의 순번(1 부터, 오래된 것부터). **다른 주문의 `id` 와 겹친다** - 전역 키로 쓰지 않는다(목록 키는 주문 id 와 같이) */
  id: number
  refundId: string | null
  /** `ORDER_CREATED` · `CONFIRM_SUCCEEDED` · `REFUND_SENT` … — 모르는 종류는 중립 글자 */
  type: string
  fromStatus: string | null
  toStatus: string | null
  actor: 'USER' | 'OPERATOR' | 'SYSTEM' | 'PROVIDER'
  /** 행위자가 사람이면 그 계정 · 운영자 id, 시스템 · 결제사면 `null`. 화면에 그리지 않는다(계정 id 를 이력마다 늘어놓지 않는다 - 한 건 화면의 「계정」 한 곳에서 본다) */
  actorId: string | null
  providerCode: string | null
  providerTraceId: string | null
  traceId: string | null
  createdAt: string
}

/** `GET /orders/{id}` — 한 건 + 환불 + 이력 */
export type AdminOrderDetail = {
  order: AdminOrder
  refunds: AdminRefund[]
  events: PaymentEvent[]
}

export type AdminOrderListParams = {
  status?: OrderStatus
  accountId?: string
  /** 결제 번호 또는 결제사 결제 번호의 정확한 값 */
  q?: string
  /** `true` 면 확인 필요만 - 탈퇴한 계정의 결제도 보인다 */
  review?: boolean
  /**
   * `true` 면 탈퇴한 계정의 결제도 - 서버는 이것들을 기본으로 숨긴다(계약 3.1). 결제 번호로 정확히 찾을 때(`q`)와 `review` 에서는 이 값과 상관없이 보인다.
   * 거짓이면 보내지 않는다
   */
  includeErased?: boolean
  cursor?: string
  size?: number
}

export type AdminRefundListParams = {
  status?: RefundStatus
  cursor?: string
  size?: number
}

/** 운영자가 직접 하는 환불의 사유 — 본인이 고르는 셋 + 운영자 판단(`OPERATOR`) */
export type OperatorRefundReason = RefundRequestReason | 'OPERATOR'

/** 금액을 비우면 남은 전액. 이 패키지의 화면은 늘 금액을 적어 보낸다(창이 보인 금액 = 보낸 금액) */
export type OperatorRefundInput = { reasonCode: OperatorRefundReason; amount?: number }

/** 수신함 줄의 상태 — 계약 3 「수신함」 */
export type WebhookEventStatus = 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'FAILED' | 'DEAD'

/** 웹훅 수신함 한 줄 — 받은 사실과 처리 결과. 본문은 없다 */
export type WebhookEvent = {
  id: number
  provider: string
  /** 결제사의 이벤트 이름(토스: `PAYMENT_STATUS_CHANGED`) */
  eventType: string
  resourceType: string
  /**
   * **우리 주문의 결제 키**(`providerPaymentId`, 토스 `paymentKey`) - 결제사의 자원 번호가 아니다. 결제 키가 아직 없는 주문(결제창만 열고 승인 전)은 `order:<주문 id>` 모양이다 -
   * 화면은 이 모양을 코드로 보이지 않고 「결제사 결제 번호 없음」으로 푼다(`isOrderResourceId`)
   */
  resourceId: string
  orderId: string | null
  status: WebhookEventStatus
  /** 같은 이벤트가 도착한 횟수 */
  deliveries: number
  /** 우리 쪽 이유 코드(`MODE_MISMATCH` · `LOOKUP_UNAVAILABLE` …) — 문장이 아니다 */
  lastError: string | null
  receivedAt: string
  processedAt: string | null
}

export type WebhookEventListParams = {
  status?: WebhookEventStatus
  cursor?: string
  size?: number
}
