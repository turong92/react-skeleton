import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createIntentKeys } from './queries'
import type { PaymentSubscriptionApi } from './subscriptionApi'
import type { MySubscriptionQueryOptions } from './subscriptionQueries'
import {
  activateSubscriptionMutation,
  cancelNowMutation,
  cancelPreviewQuery,
  cancelScheduledChangeMutation,
  cancelSubscriptionMutation,
  changePlanMutation,
  mySubscriptionQuery,
  planChangePreviewQuery,
  startSubscriptionMutation,
  subscriptionPlansQuery,
} from './subscriptionQueries'

/** 구독 플랜 목록(코드 · 이름 · 금액 · 주기 · 등급) */
export function useSubscriptionPlans(api: PaymentSubscriptionApi) {
  return useQuery(subscriptionPlansQuery(api))
}

/** 내 구독(없으면 `data.subscription` 이 `null`) + 최근 결제 5건. 첫 결제를 확인하는 동안(`PENDING`)만 간격을 늘려 가며 다시 묻는다 */
export function useMySubscription(
  api: PaymentSubscriptionApi,
  options?: MySubscriptionQueryOptions,
) {
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

/** 위 등급으로 바꾸면 지금 얼마가 결제되는가. `planCode` 가 `null` 이면 묻지 않는다(창이 닫혔거나 아직 고르지 않았다) */
export function usePlanChangePreview(
  api: PaymentSubscriptionApi,
  id: string,
  planCode: string | null,
) {
  return useQuery({
    ...planChangePreviewQuery(api, id, planCode ?? ''),
    enabled: planCode !== null,
  })
}

/** 플랜을 위 등급으로 바꾼다 - 변수 `{ id, planCode, expectedCharge }`. `data.pendingPlanCode` 가 있으면 결제 확인 중이다. 거절은 `PAYMENT.DECLINED`(플랜 그대로) */
export function useChangeSubscriptionPlan(api: PaymentSubscriptionApi) {
  const client = useQueryClient()
  const [keys] = useState(() => createIntentKeys())
  return useMutation(changePlanMutation(api, client, keys))
}

/** 예약된 플랜 변경을 거둔다 - 변수는 구독 id. 끝나면 캐시를 새로 고친다 */
export function useCancelScheduledChange(api: PaymentSubscriptionApi) {
  const client = useQueryClient()
  return useMutation(cancelScheduledChangeMutation(api, client))
}

/** 지금 해지하면 얼마가 돌아오는가(`data.open` 이 `false` 면 이 나라는 기간 끝 해지만). `enabled` 가 `false` 면 묻지 않는다. 금액이 변하니 확인 창을 열 때 `refetch()` 한다 */
export function useCancelPreview(api: PaymentSubscriptionApi, id: string, enabled = true) {
  return useQuery({ ...cancelPreviewQuery(api, id), enabled })
}

/** 지금 해지하고 환불받는다 - 변수는 구독 id, `data.refunds` 가 주문별 환불 결과. 끝나면 캐시를 새로 고친다 */
export function useCancelSubscriptionNow(api: PaymentSubscriptionApi) {
  const client = useQueryClient()
  return useMutation(cancelNowMutation(api, client))
}
