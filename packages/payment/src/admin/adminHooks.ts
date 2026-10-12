import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createIntentKeys, type IntentKeys } from '../intentKeys'
import type { PaymentAdminApi } from './adminApi'
import {
  adminOrderQuery,
  adminOrdersQuery,
  adminRefundRequestsQuery,
  adminWebhookEventsQuery,
  approveRefundMutation,
  refundOrderMutation,
  rejectRefundMutation,
  retryWebhookEventMutation,
  closeSubscriptionChargeMutation,
  syncOrderMutation,
} from './adminQueries'
import type { AdminOrderListParams, AdminRefundListParams, WebhookEventListParams } from './types'

/** 운영자 결제 목록(커서 이어받기 — `fetchNextPage`). `review: true` 는 확인 필요만 */
export function useAdminOrders(
  api: PaymentAdminApi,
  params: Omit<AdminOrderListParams, 'cursor'> = {},
) {
  return useInfiniteQuery(adminOrdersQuery(api, params))
}

/** 한 건 + 환불 + 이력. `id` 가 없으면 묻지 않는다. 되묻지 않는다 — 운영자가 보는 동안 바뀌면 작업이 끝나며 새로 읽는다 */
export function useAdminOrder(api: PaymentAdminApi, id: string | undefined) {
  return useQuery({ ...adminOrderQuery(api, id ?? ''), enabled: id !== undefined && id !== '' })
}

/** 환불 요청 목록 — 상태를 주지 않으면 결정을 기다리는 것(`REQUESTED`) */
export function useAdminRefundRequests(
  api: PaymentAdminApi,
  params: Omit<AdminRefundListParams, 'cursor'> = {},
) {
  return useInfiniteQuery(adminRefundRequestsQuery(api, params))
}

/** 웹훅 수신함 */
export function useAdminWebhookEvents(
  api: PaymentAdminApi,
  params: Omit<WebhookEventListParams, 'cursor'> = {},
) {
  return useInfiniteQuery(adminWebhookEventsQuery(api, params))
}

/**
 * 직접 환불(돈이 나간다). 변수 `{ orderId, reasonCode, amount?, idempotencyKey? }`. 훅이 「한 번의 의도」의 `Idempotency-Key` 를 들고 있다:
 * **결과를 모를 때**(네트워크 오류 · 시간 초과 · 5xx · 장부 코드가 없는 답) 같은 입력으로 다시 누르면 같은 키(10분이 지나도 놓지 않는다 - 확정 판정이나 성공이 올 때까지), 결과가 정해지면(성공 · 장부 코드가 붙은 확정 답 - 결제사 거절 · 409 · 400 · 404 · 503 - · 환불 없이 닫힌 줄) · 입력이 바뀌면 새 키(입력이 바뀌는 것은 화면이 막는다 - `useDirectRefund`). 10분 나이 제한은 모름이 아닌 키에만 적용된다.
 * `data` 는 `SUCCEEDED`(200) 또는 `PENDING`(202) 환불 줄 — 답 줄이 `FAILED` · `REJECTED` 로 닫혀 있으면 성공이 아니라 `RefundNotDoneError`(오류 판정은 `refundProblemOf`).
 */
export function useOperatorRefund(
  api: PaymentAdminApi,
  /** 키 보관소를 부모가 쥘 때(`useDirectRefund` 가 「결제사와 맞추기」 뒤에 든 키를 놓는다) - 주지 않으면 훅이 하나 만든다 */
  ownKeys?: IntentKeys,
) {
  const client = useQueryClient()
  const [made] = useState(() => createIntentKeys())
  return useMutation(refundOrderMutation(api, client, ownKeys ?? made))
}

/** 요청을 승인한다 = 환불 실행(돈이 나간다). 변수는 환불 줄 id, 금액을 고쳐 승인하면 `{ id, amount }`. 답 줄이 환불 없이 닫혀 있으면 `RefundNotDoneError`. 확인 창까지 이은 것은 `useRefundDecision` */
export function useApproveRefund(api: PaymentAdminApi) {
  const client = useQueryClient()
  return useMutation(approveRefundMutation(api, client))
}

/** 요청을 거절한다(돈은 안 움직인다). 변수는 환불 줄 id */
export function useRejectRefund(api: PaymentAdminApi) {
  const client = useQueryClient()
  return useMutation(rejectRefundMutation(api, client))
}

/** 「결제사와 맞추기」 — 결제사에 물어 장부를 맞춘다. 변수는 결제 번호 */
export function useSyncOrder(api: PaymentAdminApi) {
  const client = useQueryClient()
  return useMutation(syncOrderMutation(api, client))
}

/** 막힌 구독 결제를 「결제 안 됨」으로 닫는다 - 서버가 닫기 전에 결제사에 한 번 더 묻고, 결제된 것으로 나오면 닫지 않고 결제됨으로 맞춘다. 변수는 결제 번호 */
export function useCloseSubscriptionCharge(api: PaymentAdminApi) {
  const client = useQueryClient()
  return useMutation(closeSubscriptionChargeMutation(api, client))
}

/** 수신함의 한 줄을 다시 처리한다 */
export function useRetryWebhookEvent(api: PaymentAdminApi) {
  const client = useQueryClient()
  return useMutation(retryWebhookEventMutation(api, client))
}
