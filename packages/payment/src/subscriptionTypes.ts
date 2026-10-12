import type { Order, OrderCard } from './ledgerTypes'
import type { PaymentAmount } from './types'

/** 구독 상태(계약 §12.1). `PAST_DUE` = 갱신이 거절돼 다시 시도하는 중(이용 불가) · `CANCELING` = 해지 예약(기간 끝까지 이용) */
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELING' | 'ENDED'

/** `ENDED` 일 때 끝난 이유 */
export type SubscriptionEndReason =
  | 'FIRST_PAYMENT_DECLINED'
  | 'USER_CANCELED'
  | 'PAYMENT_FAILED'
  | 'ACCOUNT_ERASED'
  | 'RENEWAL_BLOCKED'
  | 'REFUNDED'

/** 구독 응답 — 빌링키 · 고객 키는 어디에도 없다. 금액은 만들 때 박힌 값이다 */
export type Subscription = {
  id: string
  status: SubscriptionStatus
  planCode: string
  /** 앱 플랜 목록의 이름(사라졌으면 코드) */
  planName: string
  amount: PaymentAmount
  /** ISO-8601 주기(`P1M` · `PT3M`) */
  period: string
  currentPeriodStart: string
  /** 다음 결제일. `CANCELING` 이면 이용이 끝나는 날 */
  currentPeriodEnd: string
  /** 이번 기간의 시도 번호 — `PAST_DUE` 에서 몇 번째 재시도인지 */
  attempt: number
  endReason: SubscriptionEndReason | null
  /** 끝난 구독은 `null` */
  card: OrderCard | null
  /** 플랜 변경의 결제를 확인하는 동안 바뀔 플랜 코드(`planCode` 는 아직 옛 플랜). 아니면 `null` */
  pendingPlanCode: string | null
  testMode: boolean
  createdAt: string
}

export type SubscriptionPlan = {
  code: string
  name: string
  amount: PaymentAmount
  period: string
  /** 높을수록 윗등급 */
  level: number
}

/** 카드 등록 창에 넘길 값 — 결제사 모듈이 만들고 프론트가 `kind` 로 갈라 연다. `customerKey` 만 공개해도 되는 값이다 */
export type TossBillingAuth = {
  provider: string
  kind: 'TOSS_BILLING_AUTH'
  /** 결제사 모듈이 정한다 - 없으면 `null`. `openBillingAuth` 는 키 없이 창을 열지 않고 던진다 */
  clientKey: string | null
  testMode: boolean
  customerKey: string
  attributes: Record<string, string>
}
export type BillingAuth = TossBillingAuth

/** `billingAuth` 는 같은 키로 다시 보냈는데 카드를 이미 냈으면 `null` 이다(`200`) */
export type StartSubscriptionResult = {
  subscription: Subscription
  billingAuth: BillingAuth | null
}

export type StartSubscriptionInput = { planCode: string }

/** 카드 등록 창에서 돌아온 `authKey` 로 빌링키를 만들고 첫 결제를 한다 */
export type ActivateSubscriptionInput = { providerPayload: { authKey: string } }

/** `GET /subscriptions/me` — 구독이 없으면 `subscription: null`. `orders` 는 최근 결제 5건 */
export type MySubscription = { subscription: Subscription | null; orders: Order[] }

/** `GET /subscriptions/{id}/change-preview` - `charge` 가 지금 결제될 금액(0 이면 과금 없이 바뀐다), `amount` 는 새 플랜의 전체 가격, `restartsPeriod` 면 오늘부터 새 기간 */
export type PlanChangePreview = {
  planCode: string
  planName: string
  charge: PaymentAmount
  amount: PaymentAmount
  period: string
  restartsPeriod: boolean
}

/** `expectedCharge` 는 미리보기로 본 `charge.amount` - 서버가 다시 계산한 값이 더 크면 409 `PLAN_CHANGE_CHARGE_CHANGED` */
export type ChangePlanInput = { planCode: string; expectedCharge: number }
