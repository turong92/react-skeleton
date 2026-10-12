import type { QueryClient } from '@tanstack/react-query'
import type { ApiCursorResponse } from '@skeleton/api-client'
import type { IntentKeys } from '../intentKeys'
import type { IdempotentCall } from '../ledgerTypes'
import { holdKey, keyOf, paymentKeys, releaseKey } from '../queries'
import type { PaymentAdminApi } from './adminApi'
import { assertRefundDone, refundVerdictIsKnown } from './refundOutcome'
import type {
  AdminOrderListParams,
  AdminRefundListParams,
  OperatorRefundInput,
  WebhookEventListParams,
} from './types'

type CursorParams = { cursor?: string }

/**
 * 운영자 쪽 키는 사용자 쪽과 같은 뿌리(`['payment']`) 아래 `admin` 가지다 — 운영자가 환불하면 뿌리를 무효화해
 * 같은 브라우저의 사용자 화면(내 결제 내역)도 새로 읽는다.
 */
export const adminKeys = {
  all: [...paymentKeys.all, 'admin'] as const,
  orders: (params: Omit<AdminOrderListParams, 'cursor'> = {}) =>
    [...adminKeys.all, 'orders', params] as const,
  order: (id: string) => [...adminKeys.all, 'order', id] as const,
  refunds: (params: Omit<AdminRefundListParams, 'cursor'> = {}) =>
    [...adminKeys.all, 'refunds', params] as const,
  webhookEvents: (params: Omit<WebhookEventListParams, 'cursor'> = {}) =>
    [...adminKeys.all, 'webhook-events', params] as const,
}

const nextCursorOf = (last: ApiCursorResponse<unknown>): string | undefined =>
  last.cursor.hasNext ? (last.cursor.nextCursor ?? undefined) : undefined

/** 커서 목록 쿼리의 공통 모양 — 다음 쪽이 있을 때만 이어 받는다 */
function cursorList<Row, Params extends CursorParams>(
  key: readonly unknown[],
  params: Omit<Params, 'cursor'>,
  fetchPage: (params: Params) => Promise<ApiCursorResponse<Row>>,
) {
  return {
    queryKey: key,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchPage({
        ...params,
        ...(pageParam !== undefined ? { cursor: pageParam } : {}),
      } as Params),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursorOf,
  }
}

export function adminOrdersQuery(
  api: PaymentAdminApi,
  params: Omit<AdminOrderListParams, 'cursor'> = {},
) {
  return cursorList(adminKeys.orders(params), params, api.listOrders)
}

export function adminOrderQuery(api: PaymentAdminApi, id: string) {
  return { queryKey: adminKeys.order(id), queryFn: () => api.getOrder(id) }
}

/** 환불 요청 목록 — 상태를 주지 않으면 `REQUESTED`(운영자가 결정할 것) */
export function adminRefundRequestsQuery(
  api: PaymentAdminApi,
  params: Omit<AdminRefundListParams, 'cursor'> = {},
) {
  const withStatus = { status: 'REQUESTED' as const, ...params }
  return cursorList(adminKeys.refunds(withStatus), withStatus, api.listRefunds)
}

export function adminWebhookEventsQuery(
  api: PaymentAdminApi,
  params: Omit<WebhookEventListParams, 'cursor'> = {},
) {
  return cursorList(adminKeys.webhookEvents(params), params, api.listWebhookEvents)
}

/**
 * 뿌리를 다시 읽으라고 한다. **변경의 `onSettled` 는 이 약속을 돌려줘야 한다**(`void` 로 버리지 않는다): 그래야 다시 읽기가 끝날 때까지 변경이 `pending` 이고
 * 단추가 잠겨, 방금 환불이 나갔는데 낡은 화면에서 같은 환불 · 요청이 또 나가지 않는다 - `statusWhileReReading` 시험이 지킨다(운영자 쪽 변경은 이 파일 아래 전부).
 */
const invalidateRoot = (client: QueryClient) =>
  client.invalidateQueries({ queryKey: paymentKeys.all })

/**
 * 직접 환불(돈이 나간다). 「한 번의 의도」의 `Idempotency-Key` 를 훅이 들고 있다(`useRequestRefund` 와 같은 방식) —
 * **결과를 모를 때**(네트워크 오류 · 시간 초과 · 5xx) 같은 입력으로 다시 누르면 같은 키라 서버가 같은 환불을 돌려준다.
 * 결과가 정해지면 키를 놓는다: 성공(`SUCCEEDED` · `PENDING`)뿐 아니라 장부 코드(`PAYMENT.*`)가 붙은 확정 답(402 `REFUND_DECLINED` · 400 `REFUND_AMOUNT_EXCEEDED` · 409 · 404 …, 503 `PAYMENT.UNAVAILABLE`),
 * 서버가 선점 전에 요청의 모양을 거절한 400 `invalid` 셋(`COMMON.VALIDATION_FAILED` · `COMMON.PARAMETER_VALIDATION_FAILED` · `COMMON.MALFORMED_REQUEST` - 아무것도 안 나갔다)과, 200 인데 줄이
 * `FAILED` · `REJECTED` 로 닫혀 있는 답(`RefundNotDoneError`)도 - 마지막 경우는 키를 든 채 다시 누르면 서버가 새 환불 줄을 만들 수 없고(`dedupe_key` 는 유니크)
 * 같은 닫힌 줄만 돌려주기 때문이다. 장부 코드가 없는 답(코드 없는 4xx · 네트워크 · 시간 초과 · 5xx · `PROVIDER_NOT_FOUND` · `ROUTING_FAILED` 등)은 **모름**이다 - 키를 든다.
 * 모름으로 든 키는 10분 나이 제한도 적용하지 않는다(확정 판정이나 성공이 올 때까지 든다 - `IntentKeys.hold`). 끝나면 어느 쪽이든 뿌리를 새로 읽는다(거절 · 답 유실이어도 서버에 환불 줄이 생겼을 수 있다).
 */
export function refundOrderMutation(api: PaymentAdminApi, client: QueryClient, keys?: IntentKeys) {
  type Variables = OperatorRefundInput & IdempotentCall & { orderId: string }
  return {
    mutationFn: async (variables: Variables) => {
      const { orderId, idempotencyKey, ...input } = variables
      const key = keyOf(
        keys,
        variables,
        JSON.stringify([orderId, input.reasonCode, input.amount ?? null]),
        idempotencyKey,
      )
      return assertRefundDone(
        await api.refundOrder(
          orderId,
          input,
          key !== undefined ? { idempotencyKey: key } : undefined,
        ),
      )
    },
    onSuccess: (_refund: unknown, variables: Variables) => releaseKey(keys, variables),
    onError: (error: unknown, variables: Variables) => {
      if (refundVerdictIsKnown(error)) releaseKey(keys, variables)
      else holdKey(keys, variables) // 모름 - 시간이 지나도 이 키를 든다(10분 뒤 같은 입력이 새 키로 나가 두 번 환불되지 않게)
    },
    onSettled: () => invalidateRoot(client),
  }
}

/**
 * 요청 승인 = 환불 실행. 거절(402)이어도 서버에서 환불 줄이 바뀌었을 수 있어 끝나면 늘 새로 읽는다.
 * 답 줄이 환불 없이 닫혀 있으면(`FAILED` · `REJECTED`) 성공이 아니다(`RefundNotDoneError`).
 */
export function approveRefundMutation(api: PaymentAdminApi, client: QueryClient) {
  return {
    // 변수는 환불 줄 id, 금액을 고쳐 승인하면 `{ id, amount }`
    mutationFn: async (variables: string | { id: string; amount?: number }) => {
      const { id, amount } = typeof variables === 'string' ? { id: variables } : variables
      return assertRefundDone(
        await (amount !== undefined ? api.approveRefund(id, amount) : api.approveRefund(id)),
      )
    },
    onSettled: () => invalidateRoot(client),
  }
}

export function rejectRefundMutation(api: PaymentAdminApi, client: QueryClient) {
  return {
    mutationFn: (refundId: string) => api.rejectRefund(refundId),
    onSettled: () => invalidateRoot(client),
  }
}

export function syncOrderMutation(api: PaymentAdminApi, client: QueryClient) {
  return {
    mutationFn: (orderId: string) => api.syncOrder(orderId),
    onSettled: () => invalidateRoot(client),
  }
}

export function retryWebhookEventMutation(api: PaymentAdminApi, client: QueryClient) {
  return {
    mutationFn: (id: number) => api.retryWebhookEvent(id),
    onSettled: () => invalidateRoot(client),
  }
}
