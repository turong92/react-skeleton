import { newIdempotencyKey, type ApiClient } from '@skeleton/api-client'
import { CONFIRM_TIMEOUT_MS } from './ledgerApi'
import type { IdempotentCall } from './ledgerTypes'
import type {
  ActivateSubscriptionInput,
  MySubscription,
  StartSubscriptionInput,
  StartSubscriptionResult,
  Subscription,
  SubscriptionPlan,
} from './subscriptionTypes'

export type PaymentSubscriptionApi = {
  /** `GET {basePath}/subscriptions/plans` */
  plans(): Promise<SubscriptionPlan[]>
  /** `POST {basePath}/subscriptions` + `Idempotency-Key` → `{ subscription (PENDING), billingAuth }`. 같은 키 다시 → 같은 줄 */
  start(input: StartSubscriptionInput, options?: IdempotentCall): Promise<StartSubscriptionResult>
  /** `POST {basePath}/subscriptions/{id}/activate` → `ACTIVE`(200) 또는 `PENDING`(202, 첫 결제 확인 중). 거절은 `PAYMENT.DECLINED` 로 던진다 */
  activate(id: string, input: ActivateSubscriptionInput): Promise<Subscription>
  /** `GET {basePath}/subscriptions/me` */
  me(): Promise<MySubscription>
  /** `POST {basePath}/subscriptions/{id}/cancel` — `ACTIVE` → `CANCELING`, `PAST_DUE` 는 바로 `ENDED`. 다시 눌러도 같은 답 */
  cancel(id: string): Promise<Subscription>
}

export type PaymentSubscriptionApiOptions = {
  /** 장부 HTTP 의 경로(기본 `/payments`) — 구독 경로는 그 아래 `/subscriptions` */
  basePath?: string
  /** 첫 결제를 하는 `activate` 호출만의 제한 시간. 기본 {@link CONFIRM_TIMEOUT_MS} */
  activateTimeoutMs?: number
}

/** 백엔드 구독 경로(`skeleton.payment.subscription.enabled=true`)를 부르는 호출 모음 */
export function createSubscriptionApi(
  client: Pick<ApiClient, 'value'>,
  {
    basePath = '/payments',
    activateTimeoutMs = CONFIRM_TIMEOUT_MS,
  }: PaymentSubscriptionApiOptions = {},
): PaymentSubscriptionApi {
  const base = `${basePath.replace(/\/+$/, '')}/subscriptions`
  const enc = encodeURIComponent
  return {
    plans: async () => (await client.value<{ plans: SubscriptionPlan[] }>(`${base}/plans`)).plans,
    start: (input, { idempotencyKey = newIdempotencyKey() } = {}) =>
      client.value<StartSubscriptionResult>(base, {
        method: 'POST',
        json: input,
        idempotencyKey,
      }),
    activate: (id, input) =>
      client.value<Subscription>(`${base}/${enc(id)}/activate`, {
        method: 'POST',
        json: input,
        timeoutMs: activateTimeoutMs,
      }),
    me: () => client.value<MySubscription>(`${base}/me`),
    cancel: (id) => client.value<Subscription>(`${base}/${enc(id)}/cancel`, { method: 'POST' }),
  }
}
