/** 백엔드 `PaymentAmount` — 금액은 `Long`(최소 단위 정수 · KRW 는 원), 통화는 ISO 4217 */
export type PaymentAmount = { amount: number; currency: string }

/** 백엔드 `PaymentOperationStatus` */
export type PaymentOperationStatus =
  | 'CONFIRMED'
  | 'CANCELED'
  | 'REFUNDED'
  | 'PENDING'
  | 'FAILED'
  | 'UNKNOWN'

/** 백엔드 `ProviderTrace` */
export type ProviderTrace = {
  provider: string
  providerRequestId?: string | null
  providerOperationId?: string | null
  rawCode?: string | null
  rawStatus?: string | null
  metadata?: Record<string, string>
}

/** 백엔드 `PaymentConfirmRequest`. `provider` 가 없으면 서버가 통화 · 국가 · 기본값으로 고른다(`PaymentProviderRouter`) */
export type PaymentConfirmRequest = {
  providerPaymentId: string
  amount: PaymentAmount
  merchantReferenceId?: string
  provider?: string
  country?: string
  /** 제공자 고유 필드(토스 · 스트라이프) — 서버가 그대로 제공자에 얹는다 */
  providerPayload?: Record<string, unknown>
}

/** 백엔드 `PaymentCancelRequest` */
export type PaymentCancelRequest = {
  providerPaymentId: string
  amount?: PaymentAmount
  reason?: string
  provider?: string
  country?: string
  providerPayload?: Record<string, unknown>
}

/** 백엔드 `PaymentRefundRequest` */
export type PaymentRefundRequest = {
  providerPaymentId: string
  amount: PaymentAmount
  reason?: string
  provider?: string
  country?: string
  providerPayload?: Record<string, unknown>
}

/** 백엔드 `PaymentOperationResult` */
export type PaymentOperationResult = {
  provider: string
  providerPaymentId: string
  status: PaymentOperationStatus
  amount?: PaymentAmount | null
  trace: ProviderTrace
  providerOperationId?: string | null
  rawProviderStatus?: string | null
  attributes: Record<string, string>
}

/** 라우팅 질의 — 백엔드 `PaymentProviderRouter.resolve(provider, amount, country)` 의 입력 */
export type PaymentRouteQuery = {
  provider?: string
  amount?: number
  /** `amount` 를 주면 필수 */
  currency?: string
  country?: string
}

/** kotlin-skeleton `apps/workbench` 의 `SkeletonPaymentController` 응답(`GET /skeleton/payments/route`) — 데모 모양 */
export type PaymentRoute = {
  provider: string
  requestedProvider?: string | null
  amount?: number | null
  currency?: string | null
  country?: string | null
  available: boolean
  /** `bean`(실제 빈으로 해석) · `configuration`(설정만) */
  source: string
}
