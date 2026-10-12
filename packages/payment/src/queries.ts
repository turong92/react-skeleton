import type { QueryClient } from '@tanstack/react-query'
import type { ApiCursorResponse } from '@skeleton/api-client'
import { confirmOutcomeOf } from './errors'
import type { IntentKeys } from './intentKeys'
import type { PaymentLedgerApi } from './ledgerApi'
import type {
  ConfirmOrderInput,
  CreateOrderInput,
  IdempotentCall,
  Order,
  OrderListParams,
  Refund,
  RefundRequestInput,
  RefundStatus,
} from './ledgerTypes'
import { ORDER_POLL_MAX_DURATION_MS, pollIntervalOf, type PollQuery } from './orderPolling'

export {
  ORDER_POLL_MAX_DURATION_MS,
  ORDER_POLL_MAX_MS,
  ORDER_POLL_MIN_MS,
  orderPollInterval,
} from './orderPolling'
export { createIntentKeys, INTENT_KEY_TTL_MS } from './intentKeys'
export type { IntentKeys } from './intentKeys'

/** 키는 한 뿌리 — 변경이 성공하면 뿌리를 무효화해 설정 · 목록 · 한 건이 함께 새로 고쳐진다 */
export const paymentKeys = {
  all: ['payment'] as const,
  config: () => [...paymentKeys.all, 'config'] as const,
  orders: () => [...paymentKeys.all, 'orders'] as const,
  orderList: (params: OrderListParams = {}) => [...paymentKeys.orders(), params] as const,
  order: (id: string) => [...paymentKeys.all, 'order', id] as const,
  subscriptionPlans: () => [...paymentKeys.all, 'subscription-plans'] as const,
  mySubscription: () => [...paymentKeys.all, 'my-subscription'] as const,
  cancelPreview: (id: string) => [...paymentKeys.all, 'cancel-preview', id] as const,
  planChangePreview: (id: string, planCode: string) =>
    [...paymentKeys.all, 'plan-change-preview', id, planCode] as const,
}

export function paymentConfigQuery(api: PaymentLedgerApi) {
  return { queryKey: paymentKeys.config(), queryFn: () => api.config() }
}

export type OrderQueryOptions = {
  /** `CONFIRMING` 을 되묻는 총 시간 상한(기본 {@link ORDER_POLL_MAX_DURATION_MS}) */
  maxPollMs?: number
}

export function orderQuery(
  api: PaymentLedgerApi,
  id: string,
  { maxPollMs = ORDER_POLL_MAX_DURATION_MS }: OrderQueryOptions = {},
) {
  return {
    queryKey: paymentKeys.order(id),
    queryFn: () => api.getOrder(id),
    refetchInterval: (query: PollQuery) => pollIntervalOf(query, maxPollMs),
  }
}

export function ordersQuery(api: PaymentLedgerApi, params: Omit<OrderListParams, 'cursor'> = {}) {
  return {
    queryKey: paymentKeys.orderList(params),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.listOrders({ ...params, ...(pageParam !== undefined ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: ApiCursorResponse<Order>): string | undefined =>
      last.cursor.hasNext ? (last.cursor.nextCursor ?? undefined) : undefined,
  }
}

/**
 * 뿌리를 다시 읽으라고 한다. **변경의 `onSettled` 는 이 약속을 돌려줘야 한다**(`void` 로 버리지 않는다): 그래야 다시 읽기가 끝날 때까지 변경이 `pending` 이고
 * 단추가 잠겨, 방금 환불이 나갔는데 낡은 화면에서 같은 환불 · 요청이 또 나가지 않는다 - `statusWhileReReading` 시험이 지킨다.
 */
export const invalidateRoot = (client: QueryClient) =>
  client.invalidateQueries({ queryKey: paymentKeys.all })

// 변경 변수 객체 → 그 호출이 쓴 키. 성공한 호출이 자기 키만 놓도록 — 변수 객체는 mutationFn 과 onSuccess 에 같은 것이 간다
const usedKeys = new WeakMap<object, string>()

export function keyOf(
  keys: IntentKeys | undefined,
  variables: object,
  intent: string,
  explicit: string | undefined,
): string | undefined {
  if (!keys) return explicit
  const key = keys.keyFor(intent, explicit)
  usedKeys.set(variables, key)
  return key
}

export function releaseKey(keys: IntentKeys | undefined, variables: object) {
  const key = usedKeys.get(variables)
  if (keys && key !== undefined) keys.release(key)
}

/** 이 호출의 결과를 모른다 - 키를 시간이 지나도 놓지 않는다(`IntentKeys.hold`) */
export function holdKey(keys: IntentKeys | undefined, variables: object) {
  const key = usedKeys.get(variables)
  if (keys && key !== undefined) keys.hold(key)
}

// 주문 만들기는 무효화하지 않는다: 결제하지 않은 시도는 어느 목록에도 없고, 기다리면 결제창이 늦게 열린다
export function createOrderMutation(
  api: PaymentLedgerApi,
  _client: QueryClient,
  keys?: IntentKeys,
) {
  return {
    mutationFn: (variables: CreateOrderInput & IdempotentCall) => {
      const { idempotencyKey, ...input } = variables
      const key = keyOf(
        keys,
        variables,
        JSON.stringify([input.itemType, input.itemRef, input.quantity ?? null]),
        idempotencyKey,
      )
      return api.createOrder(input, key !== undefined ? { idempotencyKey: key } : undefined)
    },
    onSuccess: (_order: unknown, variables: CreateOrderInput & IdempotentCall) =>
      releaseKey(keys, variables),
  }
}

/** 결과를 모르는 승인 요청을 다시 보내는 횟수(처음 한 번 + 이만큼). 총 약 25초 간격을 둔다 */
export const CONFIRM_RETRY_LIMIT = 5

/** 다시 보내기 전 기다림 — 1초에서 두 배씩, 10초에서 멈춘다. `failureCount` 는 지금까지 실패한 횟수(0부터) */
export function confirmRetryDelay(failureCount: number): number {
  return Math.min(1_000 * 2 ** failureCount, 10_000)
}

/**
 * 승인은 결과를 모르면(네트워크 오류 · 시간 초과 · 5xx · 401 갱신 실패 …) **같은 주문의 승인을 다시 보낸다** — 서버가 `CONFIRMING` 이면 202, `PAID` 면 200,
 * 결제사 멱등 키는 주문 id 라 다시 보내도 두 번 결제되지 않는다. 확정된 답(402 `DECLINED` · 400/409/404)은 다시 보내지 않는다(`confirmOutcomeOf`).
 * 다시 보내는 동안 변경은 `pending` 그대로고, 다 쓰면 마지막 오류로 끝난다. 끝나면 성공이든 실패든 캐시를 새로 고친다
 * (답을 잃었거나 거절(402)이어도 서버는 이미 상태를 바꿨을 수 있다).
 */
export function confirmOrderMutation(api: PaymentLedgerApi, client: QueryClient) {
  return {
    mutationFn: ({ orderId, ...input }: ConfirmOrderInput & { orderId: string }) =>
      api.confirmOrder(orderId, input),
    retry: (failureCount: number, error: unknown) =>
      failureCount < CONFIRM_RETRY_LIMIT && confirmOutcomeOf(error) === 'unknown',
    retryDelay: confirmRetryDelay,
    onSettled: () => invalidateRoot(client),
  }
}

// 그만둠도 실패해도 무효화한다
export function abandonOrderMutation(api: PaymentLedgerApi, client: QueryClient) {
  return {
    mutationFn: (orderId: string) => api.abandonOrder(orderId),
    onSettled: () => invalidateRoot(client),
  }
}

/**
 * 환불 요청의 답은 2xx 인데 줄이 환불 없이 닫혀 있다(`REJECTED` · `WITHDRAWN` · `FAILED`) - 든 키로 다시 보냈더니 그 사이 운영자가 거절했거나 본인이 거둔 줄을 서버가 지금 상태 그대로 돌려준 경우다.
 * 요청이 새로 들어간 것이 아니니 창을 성공처럼 닫지 않고 실패로 말한다(운영자 쪽 `RefundNotDoneError` 와 같은 집합). 든 키는 놓는다 - 다시 누르면 새 요청이다.
 * `REQUESTED`(요청이 들어갔다) · `PENDING` · `SUCCEEDED`(요청이 환불로 이어졌다)는 던지지 않는다 - 창이 닫히고 다시 읽은 화면이 사실을 말한다.
 */
export class RefundRequestNotOpenError extends Error {
  readonly refund: Refund
  constructor(refund: Refund) {
    super(`refund request ${refund.id} is ${refund.status}`)
    this.name = 'RefundRequestNotOpenError'
    this.refund = refund
  }
}

const REQUEST_CLOSED: ReadonlySet<RefundStatus> = new Set(['REJECTED', 'WITHDRAWN', 'FAILED'])

export function requestRefundMutation(
  api: PaymentLedgerApi,
  client: QueryClient,
  keys?: IntentKeys,
) {
  type Variables = RefundRequestInput & IdempotentCall & { orderId: string }
  return {
    mutationFn: async (variables: Variables) => {
      const { orderId, idempotencyKey, ...input } = variables
      const key = keyOf(
        keys,
        variables,
        JSON.stringify([orderId, input.reasonCode, input.amount ?? null]),
        idempotencyKey,
      )
      const line = await api.requestRefund(
        orderId,
        input,
        key !== undefined ? { idempotencyKey: key } : undefined,
      )
      if (REQUEST_CLOSED.has(line.status)) throw new RefundRequestNotOpenError(line)
      return line
    },
    // 성공 · 확정 거절(409 · 400) · 답을 잃음 모두 끝나면 다시 읽는다 - 거절은 화면이 낡았다는 말이다(이미 요청이 있다 · 금액이 바뀌었다)
    onSuccess: (_refund: unknown, variables: Variables) => releaseKey(keys, variables),
    // 줄이 이미 정해진 채로 돌아왔다 - 서버가 답을 했으니 든 키를 놓는다(다시 누르면 새 요청)
    onError: (error: unknown, variables: Variables) => {
      if (error instanceof RefundRequestNotOpenError) releaseKey(keys, variables)
    },
    onSettled: () => invalidateRoot(client),
  }
}

export function withdrawRefundMutation(api: PaymentLedgerApi, client: QueryClient) {
  return {
    mutationFn: (refundId: string) => api.withdrawRefund(refundId),
    // 실패여도 다시 읽는다: 409/404 는 그 사이 요청이 이미 처리됐다는 확정 답이라, 낡은 「요청 거두기」를 화면에 남기지 않는다
    onSettled: () => invalidateRoot(client),
  }
}
