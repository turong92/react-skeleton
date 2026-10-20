import { newIdempotencyKey, type ApiClient, type ApiCursorResponse } from '@skeleton/api-client'
import type { IdempotentCall } from '../ledgerTypes'
import type {
  AdminOrder,
  AdminOrderDetail,
  AdminOrderListParams,
  AdminRefund,
  AdminRefundListParams,
  OperatorRefundInput,
  WebhookEvent,
  WebhookEventListParams,
} from './types'

export type PaymentAdminApi = {
  /** `GET {basePath}/orders?status&accountId&q&review&includeErased&cursor&size` — 목록(최신순). `review: true` 는 확인 필요만. 탈퇴한 계정의 결제는 `includeErased: true` 일 때(또는 `q` · `review`) 보인다 */
  listOrders(params?: AdminOrderListParams): Promise<ApiCursorResponse<AdminOrder>>
  /** `GET {basePath}/orders/{id}` → `{ order, refunds, events }` */
  getOrder(id: string): Promise<AdminOrderDetail>
  /** `POST {basePath}/orders/{id}/refunds` + `Idempotency-Key` — 바로 환불. `200 refund(SUCCEEDED)` · `202 refund(PENDING)` · `402 PAYMENT.REFUND_DECLINED` */
  refundOrder(
    orderId: string,
    input: OperatorRefundInput,
    options?: IdempotentCall,
  ): Promise<AdminRefund>
  /** `GET {basePath}/refunds?status&cursor&size` — 환불 요청 목록 */
  listRefunds(params?: AdminRefundListParams): Promise<ApiCursorResponse<AdminRefund>>
  /**
   * `POST {basePath}/refunds/{id}/approve` — 요청을 승인한다 = 위와 같은 환불 실행(돈이 나간다). `amount`(최소 단위)를 주면 그 금액으로 - 요청 금액이나 환불 가능액을 넘으면
   * 결제사를 부르지 않고 400 `REFUND_AMOUNT_EXCEEDED`. 없으면 본문 없이 요청 금액 그대로.
   * `endSubscription: false` 면 구독 결제를 전액 환불해도 구독을 끝내지 않는다(생략 = 끝낸다)
   */
  approveRefund(refundId: string, amount?: number, endSubscription?: boolean): Promise<AdminRefund>
  /** `POST {basePath}/refunds/{id}/reject` — 요청을 거절한다(돈은 안 움직인다) */
  rejectRefund(refundId: string): Promise<AdminRefund>
  /** `POST {basePath}/orders/{id}/sync` — 「결제사와 맞추기」: 결제사에 물어 장부를 맞춘다. 확인 필요가 풀리면 `reviewReason` 이 비워진다 */
  syncOrder(orderId: string): Promise<AdminOrder>
  /**
   * `POST {basePath}/orders/{id}/close` - 결제사가 끝내 답하지 않아 확인 중(`CONFIRMING`)으로 남은 **구독 결제**를 「결제 안 됨」으로 닫는다(구독의 자리가 풀린다).
   * 서버가 닫기 전에 결제사에 한 번 더 물어, 결제된 것으로 나오면 닫지 않고 결제됨으로 맞춘다. 닫을 수 없으면 409 `PAYMENT.ORDER_NOT_CLOSABLE`
   */
  closeSubscriptionCharge(
    orderId: string,
    options?: { confirmedAtProvider?: boolean },
  ): Promise<AdminOrder>
  /** `GET {basePath}/webhook-events?status&cursor&size` — 수신함 */
  listWebhookEvents(params?: WebhookEventListParams): Promise<ApiCursorResponse<WebhookEvent>>
  /** `POST {basePath}/webhook-events/{id}/retry` — 다시 처리 */
  retryWebhookEvent(id: number): Promise<WebhookEvent>
}

/**
 * 운영자 환불 · 요청 승인 호출이 기다리는 시간(밀리초). 클라이언트 기본(15초)보다 길다 - 서버는 결제사에 먼저 조회한 뒤 환불하는 동기 호출이라 더 걸린다.
 * 이보다 걸려 시간 초과가 되면 화면은 「결과를 모름」으로 말하고 같은 키를 든다.
 */
export const OPERATOR_REFUND_TIMEOUT_MS = 45_000

export type PaymentAdminApiOptions = {
  /** 운영자 HTTP 의 경로(기본 `/admin/payments` — 백엔드 `skeleton.payment.admin` 의 기본 경로 `/api/v1/admin/payments` 에서 `/api/v1` 뒤쪽) */
  basePath?: string
  /** 환불 · 승인 호출만의 제한 시간. 기본 {@link OPERATOR_REFUND_TIMEOUT_MS} */
  refundTimeoutMs?: number
}

/** 값이 없거나 빈 글자 · `false` 인 칸은 보내지 않는다(`review=false` 를 보내면 「확인 필요가 아닌 것만」으로 읽힐 수 있다) */
function present(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === false) continue
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed !== '') out[key] = trimmed
      continue
    }
    out[key] = value
  }
  return out
}

/**
 * 백엔드 `payment-jdbc` 가 여는 운영자 경로(`skeleton.payment.admin.enabled=true` 일 때만, ADMIN 역할 — 검사는 서버)를 부르는 호출 모음.
 * 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다. 꺼져 있으면 404, 권한이 없으면 403 — `adminAccessProblem` 이 가른다.
 */
export function createPaymentAdminApi(
  client: Pick<ApiClient, 'value' | 'cursor'>,
  {
    basePath = '/admin/payments',
    refundTimeoutMs = OPERATOR_REFUND_TIMEOUT_MS,
  }: PaymentAdminApiOptions = {},
): PaymentAdminApi {
  const base = basePath.replace(/\/+$/, '')
  const enc = (id: string | number) => encodeURIComponent(String(id))
  const post = <T>(path: string) => client.value<T>(path, { method: 'POST' })
  return {
    listOrders: (params = {}) =>
      client.cursor<AdminOrder>(`${base}/orders`, { params: present(params) }),
    getOrder: (id) => client.value<AdminOrderDetail>(`${base}/orders/${enc(id)}`),
    refundOrder: (orderId, input, { idempotencyKey = newIdempotencyKey() } = {}) =>
      client.value<AdminRefund>(`${base}/orders/${enc(orderId)}/refunds`, {
        method: 'POST',
        json: input,
        idempotencyKey,
        timeoutMs: refundTimeoutMs,
      }),
    listRefunds: (params = {}) =>
      client.cursor<AdminRefund>(`${base}/refunds`, { params: present(params) }),
    approveRefund: (refundId, amount, endSubscription) =>
      client.value<AdminRefund>(`${base}/refunds/${enc(refundId)}/approve`, {
        method: 'POST',
        ...(amount !== undefined || endSubscription !== undefined
          ? {
              json: {
                ...(amount !== undefined ? { amount } : {}),
                ...(endSubscription !== undefined ? { endSubscription } : {}),
              },
            }
          : {}),
        timeoutMs: refundTimeoutMs,
      }),
    rejectRefund: (refundId) => post<AdminRefund>(`${base}/refunds/${enc(refundId)}/reject`),
    syncOrder: (orderId) => post<AdminOrder>(`${base}/orders/${enc(orderId)}/sync`),
    closeSubscriptionCharge: (orderId, { confirmedAtProvider = false } = {}) =>
      confirmedAtProvider
        ? client.value<AdminOrder>(`${base}/orders/${enc(orderId)}/close`, {
            method: 'POST',
            json: { confirmedAtProvider: true },
          })
        : post<AdminOrder>(`${base}/orders/${enc(orderId)}/close`),
    listWebhookEvents: (params = {}) =>
      client.cursor<WebhookEvent>(`${base}/webhook-events`, { params: present(params) }),
    retryWebhookEvent: (id) => post<WebhookEvent>(`${base}/webhook-events/${enc(id)}/retry`),
  }
}
