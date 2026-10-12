import { newIdempotencyKey, type ApiClient } from '@skeleton/api-client'
import { CONFIRM_TIMEOUT_MS } from './ledgerApi'
import type { IdempotentCall } from './ledgerTypes'
import type {
  ActivateSubscriptionInput,
  CancelNowResult,
  CancelPreview,
  ChangePlanInput,
  MySubscription,
  PlanChangePreview,
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
  /** `GET {basePath}/subscriptions/{id}/cancel-preview` - 지금 해지하면 얼마가 돌아오는가(`open: false` 면 이 나라는 기간 끝 해지만) */
  cancelPreview(id: string): Promise<CancelPreview>
  /**
   * `POST {basePath}/subscriptions/{id}/cancel-now` - 구독을 지금 끝내고 이번 기간의 쓰지 않은 몫을 환불한다. 다시 눌러도 같은 답(환불은 한 번).
   * 409 `PAYMENT.SUBSCRIPTION_CANCEL_NOT_ALLOWED`(정책이 닫음 · 이용 중이 아님) · 409 `PAYMENT.SUBSCRIPTION_CHARGE_IN_PROGRESS`(결제가 오가는 중). 결제사를 부르므로 `activateTimeoutMs` 를 쓴다
   */
  cancelNow(id: string): Promise<CancelNowResult>
  /** `GET {basePath}/subscriptions/{id}/change-preview?planCode=` - 위 등급으로 바꾸면 지금 얼마가 결제되는가 */
  changePreview(id: string, planCode: string): Promise<PlanChangePreview>
  /**
   * `POST {basePath}/subscriptions/{id}/change` + `Idempotency-Key` - 바뀐 구독(200) 또는 결제 확인 중(202, `pendingPlanCode`).
   * 거절은 `PAYMENT.DECLINED`(플랜 그대로), 금액이 올랐으면 409 `PAYMENT.PLAN_CHANGE_CHARGE_CHANGED`. 첫 결제처럼 결제사를 부르므로 `activateTimeoutMs` 를 쓴다
   */
  changePlan(id: string, input: ChangePlanInput, options?: IdempotentCall): Promise<Subscription>
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
    cancelPreview: (id) => client.value<CancelPreview>(`${base}/${enc(id)}/cancel-preview`),
    cancelNow: (id) =>
      client.value<CancelNowResult>(`${base}/${enc(id)}/cancel-now`, {
        method: 'POST',
        timeoutMs: activateTimeoutMs,
      }),
    changePreview: (id, planCode) =>
      client.value<PlanChangePreview>(`${base}/${enc(id)}/change-preview`, {
        params: { planCode },
      }),
    changePlan: (id, input, { idempotencyKey = newIdempotencyKey() } = {}) =>
      client.value<Subscription>(`${base}/${enc(id)}/change`, {
        method: 'POST',
        json: input,
        idempotencyKey,
        timeoutMs: activateTimeoutMs,
      }),
  }
}
