import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createIntentKeys } from './queries'
import type { PaymentSubscriptionApi } from './subscriptionApi'
import {
  activateSubscriptionMutation,
  cancelSubscriptionMutation,
  mySubscriptionQuery,
  startSubscriptionMutation,
  subscriptionPlansQuery,
} from './subscriptionQueries'

/** 구독 플랜 목록(코드 · 이름 · 금액 · 주기 · 등급) */
export function useSubscriptionPlans(api: PaymentSubscriptionApi) {
  return useQuery(subscriptionPlansQuery(api))
}

/** 내 구독(없으면 `data.subscription` 이 `null`) + 최근 결제 5건. 첫 결제를 확인하는 동안(`PENDING`)만 간격을 늘려 가며 다시 묻는다 */
export function useMySubscription(api: PaymentSubscriptionApi, options?: { maxPollMs?: number }) {
  return useQuery(mySubscriptionQuery(api, options))
}

/**
 * 구독을 시작한다 - `PENDING` 줄과 카드 등록 창 값(`data.billingAuth`)을 받는다. `useCreateOrder` 처럼 훅이 같은 플랜의 `Idempotency-Key` 를 들고 있어
 * 다시 눌러도 같은 줄이다(성공하면 새 키). 이미 구독 중이면 `PAYMENT.ALREADY_SUBSCRIBED`(409). `options.meta` 는 뮤테이션에 그대로 붙는다.
 */
export function useStartSubscription(
  api: PaymentSubscriptionApi,
  options?: { meta?: Record<string, unknown> },
) {
  const client = useQueryClient()
  const [keys] = useState(() => createIntentKeys())
  return useMutation({
    ...startSubscriptionMutation(api, client, keys),
    ...(options?.meta ? { meta: options.meta } : {}),
  })
}

/** 카드 등록 창에서 돌아온 `authKey` 로 첫 결제를 한다 - `data.status` 가 `ACTIVE` 또는 `PENDING`(확인 중). 거절은 `PAYMENT.DECLINED`. 변수 `{ id, authKey }` */
export function useActivateSubscription(api: PaymentSubscriptionApi) {
  const client = useQueryClient()
  return useMutation(activateSubscriptionMutation(api, client))
}

/** 해지를 예약한다(`ACTIVE` → `CANCELING`, `PAST_DUE` 는 바로 `ENDED`) */
export function useCancelSubscription(api: PaymentSubscriptionApi) {
  const client = useQueryClient()
  return useMutation(cancelSubscriptionMutation(api, client))
}
