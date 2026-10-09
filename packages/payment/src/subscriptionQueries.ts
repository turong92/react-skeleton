import type { QueryClient } from '@tanstack/react-query'
import { confirmOutcomeOf } from './errors'
import type { IntentKeys } from './intentKeys'
import type { IdempotentCall } from './ledgerTypes'
import { ORDER_POLL_MAX_DURATION_MS, pollWhile, type PollQuery } from './orderPolling'
import {
  CONFIRM_RETRY_LIMIT,
  confirmRetryDelay,
  invalidateRoot,
  keyOf,
  paymentKeys,
  releaseKey,
} from './queries'
import type { PaymentSubscriptionApi } from './subscriptionApi'
import type { MySubscription, StartSubscriptionInput } from './subscriptionTypes'

export function subscriptionPlansQuery(api: PaymentSubscriptionApi) {
  return { queryKey: paymentKeys.subscriptionPlans(), queryFn: () => api.plans() }
}

/** 첫 결제를 결제사가 아직 답하지 않았다(`PENDING`) - 되묻는다. 주문의 `CONFIRMING` 과 같은 간격 · 상한(`pollWhile`) */
const checkingFirstPayment = (data: MySubscription | undefined) =>
  data?.subscription?.status === 'PENDING'

export function mySubscriptionQuery(
  api: PaymentSubscriptionApi,
  { maxPollMs = ORDER_POLL_MAX_DURATION_MS }: { maxPollMs?: number } = {},
) {
  return {
    queryKey: paymentKeys.mySubscription(),
    queryFn: () => api.me(),
    refetchInterval: (query: PollQuery<MySubscription>) =>
      pollWhile(query, checkingFirstPayment, maxPollMs),
  }
}

// 구독 시작은 무효화하지 않는다(주문 만들기처럼): 시작하지 않은 `PENDING` 은 `me` 에 보이지 않고, 기다리면 카드 등록 창이 늦게 열린다
export function startSubscriptionMutation(
  _api: PaymentSubscriptionApi,
  _client: QueryClient,
  keys?: IntentKeys,
) {
  type Variables = StartSubscriptionInput & IdempotentCall
  return {
    mutationFn: (variables: Variables) => {
      const { idempotencyKey, ...input } = variables
      const key = keyOf(keys, variables, input.planCode, idempotencyKey)
      return _api.start(input, key !== undefined ? { idempotencyKey: key } : undefined)
    },
    onSuccess: (_result: unknown, variables: Variables) => releaseKey(keys, variables),
  }
}

/**
 * 카드 등록 창에서 돌아온 `authKey` 로 첫 결제를 한다. 결과를 모르면(네트워크 · 시간 초과 · 5xx) 같은 구독의 `activate` 를 다시 보낸다 -
 * 서버가 재전송을 안전하게 받는다(`200 ACTIVE` / `202 PENDING`). 확정된 답(402 `DECLINED` · 400 · 409 · 404)은 다시 보내지 않는다.
 * 끝나면 성공이든 실패든 캐시를 새로 고친다(거절이어도 서버는 구독을 `ENDED` 로 바꿨다).
 */
export function activateSubscriptionMutation(api: PaymentSubscriptionApi, client: QueryClient) {
  return {
    mutationFn: ({ id, authKey }: { id: string; authKey: string }) =>
      api.activate(id, { providerPayload: { authKey } }),
    retry: (failureCount: number, error: unknown) =>
      failureCount < CONFIRM_RETRY_LIMIT && confirmOutcomeOf(error) === 'unknown',
    retryDelay: confirmRetryDelay,
    onSettled: () => invalidateRoot(client),
  }
}

// 실패여도 다시 읽는다: 409/404 는 그 사이 구독이 이미 달라졌다는 확정 답이다
export function cancelSubscriptionMutation(api: PaymentSubscriptionApi, client: QueryClient) {
  return {
    mutationFn: (id: string) => api.cancel(id),
    onSettled: () => invalidateRoot(client),
  }
}
