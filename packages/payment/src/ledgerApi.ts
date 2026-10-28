import { newIdempotencyKey, type ApiClient, type ApiCursorResponse } from '@skeleton/api-client'
import type {
  ConfirmOrderInput,
  CreateOrderInput,
  CreateOrderResult,
  IdempotentCall,
  Order,
  OrderDetail,
  OrderListParams,
  OrderQuote,
  PaymentConfig,
  QuoteInput,
  Refund,
  RefundRequestInput,
} from './ledgerTypes'

export type PaymentLedgerApi = {
  /** `GET {basePath}/config` */
  config(): Promise<PaymentConfig>
  /** `POST {basePath}/quote` - 주문을 만들지 않고 할인 뒤 금액을 본다(`settlement: FREE` 면 0원). 할인 오류는 `PAYMENT.DISCOUNT_*` */
  quote(input: QuoteInput): Promise<OrderQuote>
  /** `POST {basePath}/orders` + `Idempotency-Key` → `{ order, checkout }`. 같은 키 다시 → 같은 것 */
  createOrder(input: CreateOrderInput, options?: IdempotentCall): Promise<CreateOrderResult>
  /** `POST {basePath}/orders/{id}/confirm` → `PAID` 또는 `CONFIRMING`(202) 주문. 거절은 `PAYMENT.DECLINED` 로 던진다. `CONFIRMING` 인 주문에 다른 결제 키로 보내도 409 가 아니라 202 + 지금 주문이다(새 키는 버려진다) */
  confirmOrder(id: string, input: ConfirmOrderInput): Promise<Order>
  /** `POST {basePath}/orders/{id}/abandon` — 결제창에서 그만뒀다. 이미 끝난 주문이면 지금 상태 그대로 */
  abandonOrder(id: string): Promise<Order>
  /** `GET {basePath}/orders/{id}` → `{ order, refunds }` */
  getOrder(id: string): Promise<OrderDetail>
  /** `GET {basePath}/orders?cursor&size` — 내 결제 내역(최신순, 결제하지 않은 시도는 빠진다) */
  listOrders(params?: OrderListParams): Promise<ApiCursorResponse<Order>>
  /** `POST {basePath}/orders/{id}/refund-requests` + `Idempotency-Key` — 돈은 움직이지 않는다(운영자가 승인한다) */
  requestRefund(
    orderId: string,
    input: RefundRequestInput,
    options?: IdempotentCall,
  ): Promise<Refund>
  /** `POST {basePath}/refunds/{id}/withdraw` — 내 요청을 거둔다(`REQUESTED` 일 때만) */
  withdrawRefund(refundId: string): Promise<Refund>
}

/** 승인 호출이 기다리는 시간(밀리초). 승인은 결제사 응답을 기다리는 동기 호출이고 백엔드가 그 제한을 30초로 둔다 — 그보다 길어야 느리지만 성공한 승인이 네트워크 오류가 되지 않는다 */
export const CONFIRM_TIMEOUT_MS = 45_000

export type PaymentLedgerApiOptions = {
  /** 장부 HTTP 의 경로(기본 `/payments` — 백엔드 `skeleton.payment.http.base-path` 의 `/api/v1` 뒤쪽. `/api/v1` 은 클라이언트의 baseUrl) */
  basePath?: string
  /** 승인(`confirmOrder`) 호출만의 제한 시간. 기본 {@link CONFIRM_TIMEOUT_MS} — 백엔드의 승인 제한보다 길게 둔다 */
  confirmTimeoutMs?: number
}

/** 백엔드 `payment-jdbc` 가 여는 사용자 경로를 부르는 호출 모음. 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createPaymentLedgerApi(
  client: Pick<ApiClient, 'value' | 'cursor'>,
  { basePath = '/payments', confirmTimeoutMs = CONFIRM_TIMEOUT_MS }: PaymentLedgerApiOptions = {},
): PaymentLedgerApi {
  const base = basePath.replace(/\/+$/, '')
  const enc = encodeURIComponent
  return {
    config: () => client.value<PaymentConfig>(`${base}/config`),
    quote: (input) => client.value<OrderQuote>(`${base}/quote`, { method: 'POST', json: input }),
    createOrder: (input, { idempotencyKey = newIdempotencyKey() } = {}) =>
      client.value<CreateOrderResult>(`${base}/orders`, {
        method: 'POST',
        json: input,
        idempotencyKey,
      }),
    confirmOrder: (id, input) =>
      client.value<Order>(`${base}/orders/${enc(id)}/confirm`, {
        method: 'POST',
        json: input,
        timeoutMs: confirmTimeoutMs,
      }),
    abandonOrder: (id) =>
      client.value<Order>(`${base}/orders/${enc(id)}/abandon`, { method: 'POST' }),
    getOrder: (id) => client.value<OrderDetail>(`${base}/orders/${enc(id)}`),
    listOrders: ({ cursor, size } = {}) =>
      client.cursor<Order>(`${base}/orders`, {
        params: {
          ...(cursor !== undefined ? { cursor } : {}),
          ...(size !== undefined ? { size } : {}),
        },
      }),
    requestRefund: (orderId, input, { idempotencyKey = newIdempotencyKey() } = {}) =>
      client.value<Refund>(`${base}/orders/${enc(orderId)}/refund-requests`, {
        method: 'POST',
        json: input,
        idempotencyKey,
      }),
    withdrawRefund: (refundId) =>
      client.value<Refund>(`${base}/refunds/${enc(refundId)}/withdraw`, { method: 'POST' }),
  }
}
