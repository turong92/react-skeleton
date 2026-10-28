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
import type {
  ActivationPayload,
  ChangePlanInput,
  MySubscription,
  StartSubscriptionInput,
} from './subscriptionTypes'

export function subscriptionPlansQuery(api: PaymentSubscriptionApi) {
  return { queryKey: paymentKeys.subscriptionPlans(), queryFn: () => api.plans() }
}

/** 첫 결제 · 플랜 변경 결제를 결제사가 아직 답하지 않았다(`PENDING` · `pendingPlanCode`) - 되묻는다. 주문의 `CONFIRMING` 과 같은 간격 · 상한(`pollWhile`) */
const checkingFirstPayment = (data: MySubscription | undefined) =>
  data?.subscription?.status === 'PENDING' || !!data?.subscription?.pendingPlanCode

export type MySubscriptionQueryOptions = {
  maxPollMs?: number
  /** Paddle 처럼 첫 결제가 웹훅으로 닿는 결제사의 돌아온 화면 - 시작만 한 구독은 `me` 에 보이지 않으니 구독이 보이고 `ACTIVE` 가 될 때까지 되묻는다 */
  untilActive?: boolean
  /**
   * 방금 시작한 그 구독의 id(`untilActive` 를 뜻한다). `me` 가 같은 계정의 옛 구독(`ENDED` 등)을 돌려주는 동안은 답으로 치지 않고,
   * 이 id 의 구독이 보이고 `PENDING` 을 벗어날 때까지 되묻는다
   */
  subscriptionId?: string
}

/** 구독이 아직 안 보이거나(웹훅 전) 확인 중이다 */
const waitingForWebhook = (data: MySubscription | undefined) =>
  data === undefined || data.subscription === null || checkingFirstPayment(data)

const waitingForSubscription = (id: string) => (data: MySubscription | undefined) =>
  waitingForWebhook(data) || data?.subscription?.id !== id

export function mySubscriptionQuery(
  api: PaymentSubscriptionApi,
  {
    maxPollMs = ORDER_POLL_MAX_DURATION_MS,
    untilActive = false,
    subscriptionId,
  }: MySubscriptionQueryOptions = {},
) {
  const shouldPoll =
    subscriptionId !== undefined
      ? waitingForSubscription(subscriptionId)
      : untilActive
        ? waitingForWebhook
        : checkingFirstPayment
  return {
    queryKey: paymentKeys.mySubscription(),
    queryFn: () => api.me(),
    refetchInterval: (query: PollQuery<MySubscription>) => pollWhile(query, shouldPoll, maxPollMs),
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
      // 결제 수단이 다르면 다른 의도다 - 같은 키면 서버가 처음 고른 결제사의 구독을 되돌려 준다
      // 쿠폰이 다르면(있고 없고 포함) 다른 의도다 - 같은 키면 서버가 처음 만든 구독을 되돌려 준다
      const coupons = (input.discounts ?? []).map((d) => `${d.type}:${d.ref}`)
      const intent = [
        input.planCode,
        ...(input.provider ? [input.provider] : []),
        ...(coupons.length > 0 ? [coupons] : []),
      ]
      const key = keyOf(keys, variables, JSON.stringify(intent), idempotencyKey)
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
    mutationFn: (
      variables: { id: string } & ({ authKey: string } | { providerPayload: ActivationPayload }),
    ) =>
      api.activate(variables.id, {
        providerPayload:
          'providerPayload' in variables
            ? variables.providerPayload
            : { authKey: variables.authKey },
      }),
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

/** 지금 해지하면 얼마가 돌아오는가 - 남은 기간이 줄수록 금액이 변하므로 캐시에 오래 두지 않는다(`staleTime` 0). 창을 열 때 `refetch()` 로 새로 묻는다 */
export function cancelPreviewQuery(api: PaymentSubscriptionApi, id: string) {
  return {
    queryKey: paymentKeys.cancelPreview(id),
    queryFn: () => api.cancelPreview(id),
    gcTime: 0,
  }
}

/** 지금 해지하고 환불받는다. 서버가 다시 눌러도 같은 답이므로 재시도는 하지 않는다 - 끝나면 어느 쪽이든 캐시를 새로 고친다(409 는 그 사이 구독이 달라졌다는 확정 답) */
export function cancelNowMutation(api: PaymentSubscriptionApi, client: QueryClient) {
  return {
    mutationFn: (id: string) => api.cancelNow(id),
    onSettled: () => invalidateRoot(client),
  }
}

/** 위 등급으로 바꾸면 지금 얼마가 결제되는가 - 금액은 시간에 따라 변하므로 창을 열 때마다 새로 묻는다(`staleTime` 0, 캐시에 오래 두지 않는다) */
export function planChangePreviewQuery(api: PaymentSubscriptionApi, id: string, planCode: string) {
  return {
    queryKey: paymentKeys.planChangePreview(id, planCode),
    queryFn: () => api.changePreview(id, planCode),
    gcTime: 0,
  }
}

/**
 * 플랜을 위 등급으로 바꾼다. `Idempotency-Key` 는 (구독 · 플랜 · 본 금액)마다 훅이 들고 있어 결과를 모르는 채 다시 눌러도 같은 변경이다(서버가 한 번만 결제한다).
 * 성공하거나 확정된 답(거절 402 · 409 …)을 받으면 키를 놓는다 - 거절 뒤 다시 누르면 새 시도다. 끝나면 어느 쪽이든 캐시를 새로 고친다(금액이 달라졌다면 미리보기도 다시 읽힌다).
 */
export function changePlanMutation(
  api: PaymentSubscriptionApi,
  client: QueryClient,
  keys?: IntentKeys,
) {
  type Variables = ChangePlanInput & { id: string } & IdempotentCall
  return {
    mutationFn: (variables: Variables) => {
      const { id, idempotencyKey, ...input } = variables
      const key = keyOf(
        keys,
        variables,
        JSON.stringify([id, input.planCode, input.expectedCharge]),
        idempotencyKey,
      )
      return api.changePlan(id, input, key !== undefined ? { idempotencyKey: key } : undefined)
    },
    onSuccess: (_result: unknown, variables: Variables) => releaseKey(keys, variables),
    onError: (error: unknown, variables: Variables) => {
      if (confirmOutcomeOf(error) !== 'unknown') releaseKey(keys, variables)
    },
    onSettled: () => invalidateRoot(client),
  }
}
