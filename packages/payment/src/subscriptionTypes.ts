import type { DiscountInput, Order, OrderCard } from './ledgerTypes'
import type { PaymentAmount } from './types'

/** 구독 상태(계약 §12.1). `PAST_DUE` = 갱신이 거절돼 다시 시도하는 중(이용 불가) · `CANCELING` = 해지 예약(기간 끝까지 이용) */
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELING' | 'ENDED'

/** `ENDED` 일 때 끝난 이유 */
export type SubscriptionEndReason =
  | 'FIRST_PAYMENT_DECLINED'
  | 'USER_CANCELED'
  /** 중도 해지 - 지금 끝내고 이번 기간의 쓰지 않은 몫을 환불했다 */
  | 'USER_CANCELED_NOW'
  | 'PAYMENT_FAILED'
  | 'ACCOUNT_ERASED'
  | 'RENEWAL_BLOCKED'
  | 'REFUNDED'

/** 구독 쿠폰의 혜택 단계 - 모양은 쿠폰 정의의 단계와 같다(`periods` 가 null 이면 영원히) */
export type SubscriptionDiscountStage = {
  type: 'FREE' | 'PERCENT' | 'FIXED'
  value: number
  maxDiscount: number | null
  periods: number | null
}

/** 구독에 붙은 할인 - 다음 결제 금액과 남은 할인 횟수 */
export type SubscriptionDiscount = {
  label: string
  stages: SubscriptionDiscountStage[]
  periodsUsed: number
  /** 다음 결제 금액(최소 단위, 구독 통화) */
  nextAmount: number
  /** 할인이 남은 횟수, 영원한 할인은 null */
  remainingPeriods: number | null
}

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
  /** 구매자 나라(ISO-3166 두 글자) - 해지·환불 정책을 고른 열쇠. 모르면 `null` */
  country: string | null
  /** 카탈로그 상품 코드(플랜을 모르면 `planCode`) - 가격이 바뀌어도(행사, 옛 가격) 같은 상품이다. 구버전 서버는 칸이 없다 */
  productCode?: string
  /** 상품의 등급(높을수록 위, 모르면 `null`) - 플랜 올리기가 이것으로 윗등급을 가른다. 구버전 서버는 칸이 없다 */
  level?: number | null
  /** 예약된 플랜 변경(없으면 `null`) - 구버전 서버는 칸이 없다 */
  scheduledChange?: ScheduledChange | null
  /** 어느 결제사의 구독인가(`toss` · `paddle` …) - 구버전 서버는 칸이 없다 */
  provider?: string
  /** 결제사가 직접 받은 간편결제의 앱(`KAKAOPAY` · `NAVERPAY`) - 그 밖(토스 · Paddle)과 구버전 서버는 `null` · 칸 없음 */
  easyPayBrand?: string | null
  /** 결제사가 갱신을 직접 하는 구독(Paddle) - 플랜 변경 · 중도 해지(환불)는 열리지 않고 해지는 기간 끝에만 된다 */
  providerManaged?: boolean
  /** 할인이 붙은 구독이면 그 내용, 아니면 `null` · 칸 없음 */
  discount?: SubscriptionDiscount | null
}

export type SubscriptionPlan = {
  code: string
  name: string
  amount: PaymentAmount
  period: string
  /** 높을수록 윗등급 */
  level: number
  /** 카탈로그 상품 코드 - 같은 코드의 플랜(월 · 연)은 한 카드로 묶인다. 옛 서버 · 코드로 만든 플랜은 칸이 없다(플랜 하나가 카드 하나) */
  productCode?: string
  /** 행사 중이면 정가(`amount` 와 같은 통화의 최소 단위 정수, 행사가 아니면 `null`). 지금 금액보다 클 때만 취소선으로 보인다 */
  regularAmount?: number | null
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
/** Paddle - 카드 등록이 따로 없다. 결제창(오버레이)에서 첫 결제까지 하고, 구독은 웹훅으로 `ACTIVE` 가 된다 */
export type PaddleBillingAuth = {
  provider: string
  kind: 'PADDLE_CHECKOUT'
  clientKey: string | null
  testMode: boolean
  customerKey: string
  attributes: { environment?: string; transactionId?: string }
}
/**
 * 카카오페이 정기 결제 - 카드 등록 창이 따로 없다. 서버가 `ready` 로 결제창을 예약했고(첫 결제가 곧 등록이다) 브라우저는 SDK 없이 구매자를 `attributes` 의 주소로 **보낸다**(PC · 모바일).
 * 돌아오는 주소는 서버가 정한다(`kind=KAKAOPAY_BILLING_REDIRECT&provider=…&sub=…&result=…&pg_token=…`) - `readBillingReturn` 이 읽는다
 */
export type KakaoPayBillingAuth = {
  provider: string
  kind: 'KAKAOPAY_BILLING_REDIRECT'
  clientKey: null
  testMode: boolean
  customerKey: string
  attributes: { pcUrl?: string; mobileUrl?: string; appUrl?: string }
}
/**
 * 네이버페이 정기 결제 - 등록은 돈이 움직이지 않는다. 서버가 등록을 예약했고 브라우저는 구매자를 `attributes.windowUrl` 로 **보낸다**.
 * 돌아오는 주소(`kind=NAVERPAY_BILLING_REDIRECT&provider=…&sub=…&resultCode=…&reserveId=…&tempReceiptId=…`)는 `readBillingReturn` 이 읽는다
 */
export type NaverPayBillingAuth = {
  provider: string
  kind: 'NAVERPAY_BILLING_REDIRECT'
  clientKey: null
  testMode: boolean
  customerKey: string
  attributes: { windowUrl?: string }
}
export type BillingAuth =
  | TossBillingAuth
  | PaddleBillingAuth
  | KakaoPayBillingAuth
  | NaverPayBillingAuth

/** `billingAuth` 는 같은 키로 다시 보냈는데 카드를 이미 냈으면 `null` 이다(`200`) */
export type StartSubscriptionResult = {
  subscription: Subscription
  billingAuth: BillingAuth | null
}

/** 구매자 나라 · 결제사는 보내지 않는다 - 서버가 접속 나라로 정한다(`GET /config` 의 `country` · `provider`) */
export type StartSubscriptionInput = {
  planCode: string
  /** 결제사 id - **`GET /config` 의 `subscriptionChoices` 에 둘 이상이 있을 때만** 보낸다(구매자가 고른 것). 목록 밖이면 서버는 거절하지 않고 조용히 서버가 정한 결제사로 바꾼다. 비면 서버가 정한다 */
  provider?: string
  /** 구독을 시작한 화면의 origin(`window.location.origin`) - 서버가 정한 주소로 돌려보내는 결제사(카카오페이 · 네이버페이)가 허용 목록에 있을 때만 그 origin 으로 돌려보낸다 */
  returnOrigin?: string
  /** 쿠폰 같은 할인 수단 - 쿠폰 범위에 이 플랜이 있어야 한다 */
  discounts?: DiscountInput[]
}

/**
 * 등록 창이 돌려준 값 - 토스 `authKey` · 카카오페이 `pg_token`(첫 결제의 인증) · 네이버페이 `reserveId` + `tempReceiptId`(등록 완료). 서버가 결제사마다 모양을 확인하고 틀리면 400 이다
 */
export type ActivationPayload =
  | { authKey: string }
  | { pg_token: string }
  | { reserveId: string; tempReceiptId: string }

/** 등록 창에서 돌아온 값으로 빌링키를 만들고 첫 결제를 한다 */
export type ActivateSubscriptionInput = { providerPayload: ActivationPayload }

/** `GET /subscriptions/me` — 구독이 없으면 `subscription: null`. `orders` 는 최근 결제 5건 */
export type MySubscription = { subscription: Subscription | null; orders: Order[] }

/** 플랜 변경이 적용되는 때 - `NOW` 바로(올리기 · 주기를 늘리기), `NEXT_RENEWAL` 다음 결제일부터(내리기 · 주기를 줄이기 - 예약) */
export type PlanChangeTiming = 'NOW' | 'NEXT_RENEWAL'

/** 예약된 플랜 변경 - 갱신 작업이 `effectiveAt` 에 플랜 · 금액 · 주기를 바꾼 뒤 새 금액으로 결제한다 */
export type ScheduledChange = {
  planCode: string
  planName: string
  amount: PaymentAmount
  /** ISO-8601 주기 */
  period: string
  effectiveAt: string
}

/**
 * `GET /subscriptions/{id}/change-preview` - `charge` 가 지금 결제될 금액(0 이면 과금 없이 바뀐다), `amount` 는 새 플랜의 전체 가격, `restartsPeriod` 면 오늘부터 새 기간.
 * `timing` 이 `NEXT_RENEWAL` 이면 예약이다 - 지금 결제는 없고(`charge` 0) `effectiveAt` 부터 바뀐다. 구버전 서버는 칸이 없다(= `NOW`)
 */
export type PlanChangePreview = {
  planCode: string
  planName: string
  charge: PaymentAmount
  amount: PaymentAmount
  period: string
  restartsPeriod: boolean
  timing?: PlanChangeTiming
  effectiveAt?: string
  /** 새 주기로 바꿀 때 지금 주기의 남은 몫으로 깎아 주는 금액 - `amount` = `charge` + `credit`(공제가 새 가격보다 크면 `credit` = `amount`, `charge` = 0). 깎아 주지 않으면 `null`, 구버전 서버는 칸이 없다 */
  credit?: PaymentAmount | null
}

/** `expectedCharge` 는 미리보기로 본 `charge.amount` - 서버가 다시 계산한 값이 더 크면 409 `PLAN_CHANGE_CHARGE_CHANGED` */
export type ChangePlanInput = { planCode: string; expectedCharge: number }

/** 중도 해지 계산 내역의 한 줄 - `PAID` 낸 돈(양수) · `USED` 쓴 몫(음수) · `PENALTY` 위약금(음수). 합이 환불 금액이다 */
export type CancelLine = { code: 'PAID' | 'USED' | 'PENALTY'; amount: number }

/**
 * `GET /subscriptions/{id}/cancel-preview` - `open` 이 `false` 면 이 나라의 정책이 중도 해지를 닫았다(기간 끝 해지만, `refund` 0).
 * `withdrawal` 이면 7일 철회로 전액을 돌려준다. 금액은 시간에 따라 변한다(남은 기간이 줄어든다)
 */
export type CancelPreview = {
  open: boolean
  refund: PaymentAmount
  withdrawal: boolean
  lines: CancelLine[]
}

/** 주문 하나의 환불 결과 - `PENDING` 결제사 답을 기다림 · `FAILED` 결제사가 거절함 · `NOT_SENT` 아직 못 보냄(서버가 다시 보낸다) */
export type CancelRefund = {
  orderId: string
  amount: PaymentAmount
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED' | 'NOT_SENT'
}

/** `POST /subscriptions/{id}/cancel-now` - 구독은 이미 `ENDED`(`USER_CANCELED_NOW`). `refund` 는 돌려주기로 한 합계 */
export type CancelNowResult = {
  subscription: Subscription
  refund: PaymentAmount
  withdrawal: boolean
  lines: CancelLine[]
  refunds: CancelRefund[]
}
