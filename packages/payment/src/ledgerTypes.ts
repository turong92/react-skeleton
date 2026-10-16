import type { PaddlePricePreviewConfig } from './paddle'
import type { PaymentAmount } from './types'

/** 주문 상태 — 전이는 백엔드 장부가 지킨다. 「환불 중」은 상태가 아니라 `refundPending` 이다 */
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMING'
  | 'PAID'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELED'

export type RefundStatus =
  | 'REQUESTED'
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  | 'WITHDRAWN'

/** 열린 환불(아직 끝나지 않은 줄)의 상태 — `REQUESTED` 는 요청만 했고 돈은 움직이지 않았다 · `PENDING` 은 환불이 진행 중이다 */
export type OpenRefundStatus = Extract<RefundStatus, 'REQUESTED' | 'PENDING'>

/** 환불을 만든 쪽 — 본인 요청 · 운영자 · 결제사 콘솔에서 직접 */
export type RefundOrigin = 'USER' | 'OPERATOR' | 'PROVIDER'

/** 본인이 환불 요청에 고를 수 있는 사유(고정 코드 — 자유 문장은 받지 않는다) */
export type RefundRequestReason = 'CUSTOMER_REQUEST' | 'DUPLICATE' | 'NOT_DELIVERED'

/** 카드 결제의 표시용 값 — 카드사 코드(대문자 영문)와 끝 네 글자(숫자 또는 `*`). 각각 `null` 일 수 있다 */
export type OrderCard = { issuer: string | null; last4: string | null }

/** 백엔드 주문 응답. 사용자 응답에는 결제사 이름 · 결제사 결제 번호 · 확인 필요 사유가 없다 */
export type Order = {
  id: string
  status: OrderStatus
  /** 한 번 결제 · 구독의 첫 결제 · 구독의 갱신 결제(계약 §12) */
  kind: 'ONE_TIME' | 'SUBSCRIPTION_INITIAL' | 'SUBSCRIPTION_RENEWAL' | 'SUBSCRIPTION_CHANGE'
  itemType: string
  itemRef: string
  quantity: number
  orderName: string
  amount: PaymentAmount
  refundedAmount: number
  refundableAmount: number
  /** 열린 환불이 있다 — 새 환불 요청이 안 되는 이유. 요청만 했는지 진행 중인지는 `openRefundStatus` */
  refundPending: boolean
  /**
   * 열린 환불의 상태(없으면 `null`) - 백엔드는 늘 보낸다(계약 1.1).
   * 화면 낱말: `REQUESTED` 「환불 요청함」 · `PENDING` 「환불 중」
   */
  openRefundStatus: OpenRefundStatus | null
  /** 결제 수단 종류 코드(`CARD` · `EASY_PAY` …). 결제되기 전에는 `null` */
  method: string | null
  /** 카드 결제가 아니거나 계정이 지워져 비워졌으면 `null` */
  card: OrderCard | null
  testMode: boolean
  failureCode: string | null
  createdAt: string
  paidAt: string | null
  fulfilled: boolean
}

export type Refund = {
  id: string
  orderId: string
  status: RefundStatus
  amount: PaymentAmount
  reasonCode: string
  origin: RefundOrigin
  requestedAt: string
  completedAt: string | null
  /**
   * `WITHDRAWN` 줄을 누가 닫았나 - `USER` 본인이 거뒀다 · `SYSTEM` 주문이 전액 환불돼 요청이 닫혔다. 다른 상태의 줄은 `null`(계약 1.2).
   * 사용자 응답과 운영자 응답 모두에 온다. `null` 이면 `USER` 로 읽는다
   */
  closedBy: 'USER' | 'SYSTEM' | null
  /**
   * 운영자가 금액을 고쳐 승인했다면 처음 요청한 금액(그때 `amount` 는 승인한 금액이고 둘이 다르다). 고치지 않았으면 `null` - 구버전 서버는 칸이 없다
   */
  requestedAmount?: PaymentAmount | null
}

/** `GET /config` — 결제사 빈이 없거나 클라이언트 키가 없으면 `available: false` */
export type PaymentConfig = {
  available: boolean
  testMode: boolean
  refundRequestsEnabled: boolean
  /** 결제창을 열 수 있는 결제사 id (예 `['paddle','toss']`) - 어느 것을 쓰는지는 서버가 정한다(아래 `provider`). 구버전 서버는 칸이 없다 */
  providers?: string[]
  /** 결제사 id → 가격 미리보기 값 - Paddle 처럼 구매자 통화로 환산해 결제하는 결제사만. 구버전 서버는 칸이 없다 */
  pricePreviews?: Record<string, PaddlePricePreviewConfig>
  /** 결제사 id → 결제창 안에서 바로 열 간편결제 코드(`NAVERPAY` …). 주문을 만들기 전에 단추를 그리는 데 쓴다. 목록이 빈 결제사는 키가 없다. 구버전 서버는 칸이 없다 */
  easyPays?: Record<string, string[]>
  /** 서버가 이 요청마다 정한 접속 나라(ISO-3166 두 글자). 모르면 `null`, 구버전 서버는 칸이 없다 */
  country?: string | null
  /** 그 나라로 서버가 정한 결제사 - 주문 · 구독이 실제로 쓴다(화면이 보내는 값은 없다). 정할 수 없거나 그 나라의 결제사가 못 열리면 `null`(그때 `available` 도 false) */
  provider?: string | null
  /** 그 나라의 해지·환불 정책 요약 - 화면이 `key` 로 문구를 고른다 */
  cancelPolicy?: PaymentCancelPolicy | null
  /** 서버가 개발용 나라 덮어쓰기를 켰다(로컬만) - 켜져 있으면 요청의 `X-Dev-Country` 가 `country` 를 정한다 */
  devCountrySwitch?: boolean
  /**
   * 구매자가 고를 수 있는 결제사 id - 이 나라에서 지금 열려 있는 결제사. **둘 이상일 때만** 「결제 방법」 고르기를 그리고 고른 id 를 `createOrder` 의 `provider` 로 보낸다.
   * 나라 지도에 결제사가 없고 후보가 둘이면 `provider` 는 `null` 이라 고르지 않은 주문은 거절된다. 구버전 서버는 칸이 없다
   */
  choices?: string[]
}

/** `key` 는 서버의 정책 이름(`korea` · `period-end-only` …). 숫자는 `korea` 일 때만(설정값) */
export type PaymentCancelPolicy = {
  key: string
  penaltyPercent?: number | null
  withdrawalDays?: number | null
}

/**
 * 결제창에 넘길 값 — 결제사 모듈이 만들고 프론트가 `kind` 로 갈라 연다. 공개해도 되는 값만 담는다.
 * `openCheckout` 이 모르는 `kind` 는 던진다(새 결제사 · 수단이 이 패키지보다 먼저 올 수 있다).
 */
export type TossPaymentWindowCheckout = {
  provider: string
  kind: 'TOSS_PAYMENT_WINDOW'
  /** 결제사 모듈이 정한다 - 없으면 `null`(계약 1.3). `openCheckout` 은 키 없이 결제창을 열지 않고 던진다 */
  clientKey: string | null
  testMode: boolean
  orderId: string
  orderName: string
  amount: PaymentAmount
  /** `easyPays`: 이 결제창에서 바로 열 수 있는 간편결제 코드를 쉼표로 이은 것(`NAVERPAY,KAKAOPAY`) - 서버 설정이 비면 칸이 없다. 구버전 서버는 `attributes` 도 없다 */
  attributes?: { method?: string; easyPays?: string }
}
/** Paddle(판매 대행) — 결제창은 Paddle.js 오버레이이고 결과는 웹훅으로 서버에 닿는다. 금액 · 통화는 Paddle 가격이 정한다(여러 통화) */
export type PaddleCheckout = {
  provider: string
  kind: 'PADDLE_CHECKOUT'
  /** Paddle.js 클라이언트 토큰 - 없으면 `null` */
  clientKey: string | null
  testMode: boolean
  orderId: string
  orderName: string
  amount: PaymentAmount
  attributes: { environment?: string; transactionId?: string }
}
/**
 * 카카오페이 직접 연동(단건) - 서버가 결제 준비(`ready`)를 이미 불렀다. 브라우저는 SDK 없이 구매자를 `attributes` 의 주소로 **보낸다**(PC · 모바일).
 * 공개 키가 없어 `clientKey` 는 늘 `null` 이다(`openCheckout` 도 `null` 이라고 멈추지 않는다 - 주소가 그 몫). 돌아오는 주소는 서버 설정이 정하고(`provider=kakaopay&order=…&result=…&pg_token=…`) `readKakaoPayReturn` 이 읽는다
 */
export type KakaoPayRedirectCheckout = {
  provider: string
  kind: 'KAKAOPAY_REDIRECT'
  clientKey: null
  testMode: boolean
  orderId: string
  orderName: string
  amount: PaymentAmount
  /** `pcUrl` · `mobileUrl`: 구매자가 갈 결제창(http(s) 절대 주소) · `appUrl`: 카카오톡 앱을 바로 여는 주소(이 패키지는 쓰지 않는다) */
  attributes: { pcUrl?: string; mobileUrl?: string; appUrl?: string }
}
/**
 * 네이버페이 직접 연동(단건) - 서버가 결제를 미리 만들지 않는다. 브라우저가 네이버 SDK 로 결제창을 열고(`clientKey` = 클라이언트 아이디, 공개 값) 결제를 마치면 서버 설정의 돌아올 주소
 * (`attributes.returnUrl`)로 `resultCode` · `paymentId` 가 붙어 돌아온다 - `readNaverPayReturn` 이 읽고, 그 `paymentId` 가 승인 요청의 `providerPaymentId` 다. 금액은 이 창이 정한다(서버가 승인 응답의 총액을 주문과 대조한다)
 */
export type NaverPaySdkCheckout = {
  provider: string
  kind: 'NAVERPAY_SDK'
  clientKey: string | null
  testMode: boolean
  orderId: string
  orderName: string
  amount: PaymentAmount
  /** `chainId` · `mode`(`development` \| `production`) · `returnUrl` · `taxScopeAmount` · `taxExScopeAmount`(둘의 합이 금액) */
  attributes?: {
    chainId?: string
    mode?: string
    returnUrl?: string
    taxScopeAmount?: string
    taxExScopeAmount?: string
  }
}
export type Checkout =
  | TossPaymentWindowCheckout
  | PaddleCheckout
  | KakaoPayRedirectCheckout
  | NaverPaySdkCheckout

export type CreateOrderInput = {
  itemType: string
  itemRef: string
  quantity?: number
  /**
   * 결제사 id - **`GET /config` 의 `choices` 에 둘 이상이 있을 때만** 보낸다(같은 나라에 결제사가 둘 이상 켜졌고 구매자가 고른 것). 서버는 `choices` 밖의 값을 읽지 않는다.
   * 나라는 보내지 않는다 - 서버가 접속 나라로 정한다(`GET /config`)
   */
  provider?: string
}
/**
 * `checkout` 은 같은 `Idempotency-Key` 를 다시 보냈는데 주문이 이미 `PENDING` 이 아니거나 결제 가능 시간이 지난 `PENDING` 이면 `null` 이다(`200`, 계약 2 「주문 만들기」) -
 * 열 결제창이 없다. 새 주문(`201`)은 늘 값이 있다
 */
export type CreateOrderResult = { order: Order; checkout: Checkout | null }

/** 결제창에서 돌아온 결제의 승인 요청. `amount` 는 주소에서 왔다 — 서버가 주문의 금액과 대조한다(최소 단위 정수) */
export type ConfirmOrderInput = {
  /** 토스의 `paymentKey`. 결제사가 거래 번호를 먼저 정한 주문(카카오페이)은 서버가 주문에 박아 둔 번호를 쓰니 생략한다 */
  providerPaymentId?: string
  amount: number
  /** 돌아온 결제창이 승인을 허락한 증거 - 카카오페이의 `pg_token`. 토스는 보내지 않는다 */
  approvalToken?: string
}

export type OrderDetail = { order: Order; refunds: Refund[] }

export type RefundRequestInput = { reasonCode: RefundRequestReason; amount?: number }

export type OrderListParams = { cursor?: string; size?: number }

/** 쓰기 호출이 쓰는 키. 같은 사용자 의도를 다시 보낼 때만 재사용하고, 주지 않으면 호출마다 새로 만든다 */
export type IdempotentCall = { idempotencyKey?: string }
