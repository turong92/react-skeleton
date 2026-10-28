import { isErrorCode, retryAfterSeconds, ErrorCodes } from '@skeleton/api-client'
import {
  checkoutCanOpen,
  checkoutToOpen,
  INTENT_KEY_TTL_MS,
  PaymentLedgerErrorCodes,
  PaymentRedirectError,
  readCheckoutReturn,
  readKakaoPayReturn,
  readNaverPayReturn,
  type Checkout,
  type CreateOrderInput,
  type CreateOrderResult,
  type OpenCheckoutOptions,
  type OrderStatus,
} from '@skeleton/payment'
import { CHEER_ITEM_TYPE } from './types'

/** 지금 시각(ms) - 이벤트 처리기가 렌더 순수성 검사에 걸리지 않게 한 겹 감싼 시계 */
export const nowMs = (): number => Date.now()

/** 우리가 실패 주소에 직접 싣는 주문 id 의 이름 — 결제창은 그만둠(`PAY_PROCESS_CANCELED`)에 `orderId` 를 싣지 않을 수 있다 */
export const RETURN_ORDER_PARAM = 'order'

/**
 * 결제창이 돌려보낼 주소 — 이 앱의 한 화면(`/payments/return`)이 성공 · 실패를 모두 받아 주소의 모양으로 가른다. 서버는 이 주소를 받지도 저장하지도 않는다.
 * 실패 주소에는 우리 주문 id 를 직접 싣는다(주문을 만든 뒤에 짓는다) — 결제창이 어느 주문인지 말해 주지 않아도 화면이 그 주문을 닫는다.
 */
export function checkoutReturnUrls(
  origin: string,
  orderId: string,
  provider?: string,
): Pick<OpenCheckoutOptions, 'successUrl' | 'failUrl'> {
  const back = `${origin.replace(/\/+$/, '')}/payments/return`
  // Paddle 은 실패 주소가 없고 결과가 웹훅으로 서버에 닿는다 - 돌아온 화면은 우리 주문 id 로 서버를 되묻기만 한다
  if (provider === 'paddle') {
    const watch = `${back}?provider=paddle&${RETURN_ORDER_PARAM}=${encodeURIComponent(orderId)}`
    return { successUrl: watch, failUrl: watch }
  }
  return {
    successUrl: back,
    failUrl: `${back}?${RETURN_ORDER_PARAM}=${encodeURIComponent(orderId)}`,
  }
}

export type StartCheerDeps = {
  createOrder: (input: CreateOrderInput) => Promise<CreateOrderResult>
  openCheckout: (
    checkout: Checkout,
    options: Pick<OpenCheckoutOptions, 'successUrl' | 'failUrl' | 'easyPay'>,
  ) => Promise<void>
  abandonOrder: (orderId: string) => Promise<unknown>
  /** 결제를 시작한 화면의 origin - 서버가 허용 목록에 있을 때만 쓴다(카카오페이 · 네이버페이는 돌아올 주소를 서버가 정한다). 없으면 보내지 않는다 */
  returnOrigin?: string
  /** 이 주문의 결제창이 돌려보낼 주소 */
  urlsFor: (
    orderId: string,
    provider?: string,
  ) => Pick<OpenCheckoutOptions, 'successUrl' | 'failUrl'>
}

/**
 * - `opened`: 결제창이 열렸다(대개 이 화면을 떠난다).
 * - `canceled`: 사람이 창을 닫았다 — 주문은 돌려놓았다(`abandon`). 오류가 아니다.
 * - `window-failed`: 창이 못 열렸다(스크립트 차단 · 네트워크). 주문은 그대로 두고 `created` 로 돌려준다 — 화면이 들고 있다가 다시 누르면 `startCheer` 의 세 번째 인자로 넘겨 창만 다시 연다(누를 때마다 새 주문이 쌓이지 않는다).
 * - `order-failed`: 서버가 주문을 거절했다(목록에 없는 금액 · 결제 꺼짐 · 요청이 많음 …)거나, 같은 키의 주문이 닫혀서 결제창 값 없이 돌아왔다. 창은 열지 않았다.
 * - `settled`: 같은 키의 주문이 이미 결제됐거나(`PAID` · 환불 계열) 승인 중(`CONFIRMING`)이라 결제창 값 없이 돌아왔다 - 실패가 아니다. 화면은 그 주문의 한 건 화면으로 보낸다. 창은 열지 않았다.
 * - `unavailable`: 서버에 결제창 키가 없다(`clientKey: null`) - 다시 눌러도 열 수 없다. 만든 주문은 돌려놓았다(`abandon`).
 */
export type StartCheerResult =
  | { kind: 'opened' }
  | { kind: 'canceled' }
  | { kind: 'settled'; orderId: string }
  | { kind: 'unavailable' }
  | { kind: 'window-failed'; error: unknown; created: CreateOrderResult }
  | { kind: 'order-failed'; error: unknown }

/** 같은 키를 다시 보냈을 때 결제창 값 없이 돌아와도 실패가 아닌 주문 - 돈이 이미 움직였다 */
const MONEY_MOVED: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'PAID',
  'CONFIRMING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
])

// 토스 SDK 가 창을 닫을 때 던지는 코드(`USER_CANCEL`)와, 결제창이 failUrl 에 싣는 코드(`PAY_PROCESS_CANCELED`)
const CLOSED_CODES = new Set(['USER_CANCEL', 'PAY_PROCESS_CANCELED'])
const codeOf = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : null

/**
 * 금액을 고르고 「응원하기」를 눌렀을 때 — 서버 목록의 `itemRef` 로 주문을 만들고 결제창을 연다.
 * `reuse` 는 같은 금액으로 앞서 창을 못 열었을 때 돌려받은 주문 — 있으면 주문을 새로 만들지 않고 그 주문의 창만 다시 연다.
 * `easyPay` 는 눌린 간편결제 단추(`NAVERPAY` …) - 있으면 결제창이 그 앱을 바로 연다. 없으면(카드 단추) 통합 결제창.
 */
export async function startCheer(
  deps: StartCheerDeps,
  itemRef: string,
  reuse?: CreateOrderResult,
  easyPay?: string,
  provider?: string,
  /** 고른 쿠폰 id - 있으면 주문에 `discounts` 로 싣는다(서버가 견적과 같게 다시 계산한다) */
  couponRef?: string | null,
): Promise<StartCheerResult> {
  let created: CreateOrderResult
  if (reuse) created = reuse
  else
    try {
      // `provider` 는 사람이 「결제 방법」을 골랐을 때만 간다(같은 나라에 결제사가 둘 이상 켜진 서버) - 없으면 서버가 정한다
      created = await deps.createOrder({
        itemType: CHEER_ITEM_TYPE,
        itemRef,
        ...(provider !== undefined ? { provider } : {}),
        ...(couponRef ? { discounts: [{ type: 'coupon' as const, ref: couponRef }] } : {}),
        ...(deps.returnOrigin !== undefined ? { returnOrigin: deps.returnOrigin } : {}),
      })
    } catch (error) {
      return { kind: 'order-failed', error }
    }
  // 같은 키를 다시 보냈는데 주문이 이미 결제할 수 있는 상태가 아니면 서버는 결제창 값 없이 답한다(`checkout: null`) - 열 창이 없다.
  // 이미 돈이 움직인 주문(결제됨 · 승인 중 · 환불)은 실패가 아니라 그 주문의 화면으로 보낸다. 그 밖(닫힘)은 실패 - 키는 이 답으로 풀렸으니(성공) 다음 누름은 새 주문이다
  // 쿠폰으로 0원(`FREE`)이거나 결제 면제(`EXEMPT`)인 주문은 이미 `PAID` 라 열 결제창이 없다 - `checkoutToOpen` 이 `null` 이면 아래에서 그 주문의 화면으로 보낸다
  const checkout = checkoutToOpen(created)
  if (checkout == null) {
    if (MONEY_MOVED.has(created.order.status)) return { kind: 'settled', orderId: created.order.id }
    return { kind: 'order-failed', error: new Error('The order is no longer open for payment') }
  }
  // 서버에 결제창 키가 없다(카카오페이는 키 대신 결제창 주소) - 다시 눌러도 같다. 만든 주문을 돌려놓고(못 돌려놓아도 서버의 만료 작업이 닫는다) 「지금은 결제할 수 없어요」로 말한다
  if (!checkoutCanOpen(checkout)) {
    await deps.abandonOrder(created.order.id).catch(() => undefined)
    return { kind: 'unavailable' }
  }
  try {
    await deps.openCheckout(checkout, {
      ...deps.urlsFor(created.order.id, checkout.provider),
      ...(easyPay !== undefined ? { easyPay } : {}),
    })
    return { kind: 'opened' }
  } catch (error) {
    const code = codeOf(error)
    if (code !== null && CLOSED_CODES.has(code)) {
      // 돌려놓지 못해도 사람은 창을 닫았다 — 서버의 만료 작업이 닫는다
      await deps.abandonOrder(created.order.id).catch(() => undefined)
      return { kind: 'canceled' }
    }
    return { kind: 'window-failed', error, created }
  }
}

/** 결제창을 못 연 채 화면이 들고 있는 주문 — `since` 는 결제창이 안 열린 것을 안 때(ms) */
export type UnopenedOrder = {
  itemRef: string
  created: CreateOrderResult
  since: number
  /** 사람이 , 고른 결제 방법 - 다른 방법으로 다시 누르면 그 주문의 창을 다시 열지 않는다 */
  provider?: string
  /** 주문에 건 쿠폰 - 다른 쿠폰(또는 쿠폰 없이)으로 다시 누르면 그 주문의 창을 다시 열지 않는다 */
  couponRef?: string
}

/**
 * 「응원하기」를 다시 눌렀을 때 새 주문 대신 다시 열 주문 — 같은 금액이고 {@link INTENT_KEY_TTL_MS} 안일 때만.
 * 이 상수는 결제창 유효 시간보다 짧은 수로 빌려 쓴 것이다. 시간이 지나면 버린다: 서버가 그 주문을 닫았을 수 있고, 멱등 키도 같은 시간에 새로 바뀐다(`createIntentKeys`).
 */
export function reusableOrderOf(
  unopened: UnopenedOrder | null,
  itemRef: string,
  now: number,
  provider?: string,
  couponRef?: string | null,
): CreateOrderResult | undefined {
  if (
    unopened === null ||
    unopened.itemRef !== itemRef ||
    unopened.provider !== provider ||
    unopened.couponRef !== (couponRef ?? undefined)
  )
    return undefined
  return now - unopened.since >= INTENT_KEY_TTL_MS ? undefined : unopened.created
}

/** `startCheer` 가 끝난 뒤 화면이 들고 있을 주문 — 창이 안 열린 경우만 남기고 나머지는 비운다. 같은 주문의 창이 또 안 열려도 주문이 젊어지지 않는다 */
export function unopenedAfter(
  result: StartCheerResult,
  itemRef: string,
  now: number,
  previous: UnopenedOrder | null,
  provider?: string,
  couponRef?: string | null,
): UnopenedOrder | null {
  if (result.kind !== 'window-failed') return null
  return {
    itemRef,
    created: result.created,
    since: previous?.created === result.created ? previous.since : now,
    ...(provider !== undefined ? { provider } : {}),
    ...(couponRef ? { couponRef } : {}),
  }
}

/** 결제창에서 돌아온 주소가 화면에 시키는 일 */
export type ReturnPlan =
  | { kind: 'confirm'; orderId: string; providerPaymentId: string; amount: number }
  /** 카카오페이 - 구매자가 인증을 마치고 돌아왔다. 주소에는 금액도 결제 번호도 없다: 서버가 주문에 박아 둔 번호와 주문 금액으로 승인한다(화면은 승인 토큰만 보탠다) */
  | { kind: 'approve'; orderId: string; approvalToken: string }
  /** 네이버페이 - 구매자가 결제창을 마치고 돌아왔다. 주소에는 결제 번호만 있고 금액이 없다: 화면은 읽은 주문의 금액을 보태 승인을 보낸다(서버가 주문의 금액으로 승인하고 승인 응답의 총액을 대조한다) */
  | { kind: 'confirm-held'; orderId: string; providerPaymentId: string }
  /** 결제창이 실패 주소로 돌려보냈다. `canceled` 는 사람이 창을 닫은 경우 */
  | { kind: 'left'; orderId: string | null; canceled: boolean }
  /** Paddle - 승인 호출이 없다. 웹훅이 주문을 `PAID` 로 옮기므로 서버를 되묻기만 한다 */
  | { kind: 'watch'; orderId: string }
  | { kind: 'invalid' }

export function returnPlanOf(search: string): ReturnPlan {
  const params = new URLSearchParams(search)
  // 카카오페이로 돌아온 주소는 서버가 `kind=KAKAOPAY_REDIRECT`(checkout.kind 와 같은 값)를 실어 준다 - 결제사 id 는 설정(`provider-id`)이라 이름으로 가르지 않는다
  if (params.get('kind') === 'KAKAOPAY_REDIRECT') {
    try {
      const read = readKakaoPayReturn(params)
      if (read.ok)
        return { kind: 'approve', orderId: read.orderId, approvalToken: read.approvalToken }
      return { kind: 'left', orderId: read.orderId, canceled: read.code === 'CANCELED' }
    } catch (error) {
      if (error instanceof PaymentRedirectError) return { kind: 'invalid' }
      throw error
    }
  }
  // 네이버페이도 같다 - 서버 설정의 돌아올 주소에 `kind=NAVERPAY_REDIRECT`(checkout.kind 와 같은 값)가 실려 있다
  if (params.get('kind') === 'NAVERPAY_REDIRECT') {
    try {
      const read = readNaverPayReturn(params)
      if (read.ok)
        return { kind: 'confirm-held', orderId: read.orderId, providerPaymentId: read.paymentId }
      return { kind: 'left', orderId: read.orderId, canceled: read.code === 'CANCELED' }
    } catch (error) {
      if (error instanceof PaymentRedirectError) return { kind: 'invalid' }
      throw error
    }
  }
  if (params.get('provider') === 'paddle') {
    const orderId = params.get(RETURN_ORDER_PARAM)
    return orderId ? { kind: 'watch', orderId } : { kind: 'invalid' }
  }
  try {
    const read = readCheckoutReturn(search)
    if (read.ok)
      return {
        kind: 'confirm',
        orderId: read.orderId,
        providerPaymentId: read.providerPaymentId,
        amount: read.amount,
      }
    // 결제창이 주문 id 를 싣지 않아도(그만둠) 우리가 실패 주소에 실은 것이 있다
    const ours = new URLSearchParams(search).get(RETURN_ORDER_PARAM)
    return {
      kind: 'left',
      orderId: ours || read.orderId,
      canceled: read.code === 'PAY_PROCESS_CANCELED',
    }
  } catch (error) {
    if (error instanceof PaymentRedirectError) return { kind: 'invalid' }
    throw error
  }
}

/**
 * 주문을 거절당했을 때 화면이 말할 것.
 * - `rateLimited`(429): 고정 창이 끝날 때까지 몇 번을 눌러도 429이고 같은 키 재전송도 한도를 쓴다 - 「다시 눌러 주세요」가 아니라 **언제** 다시 누를지 말한다.
 *   `until`(ms) 은 서버가 알려 준 기다림(초)이 끝나는 **시각**이다 - 그 시각을 문장에 쓰고(남은 분은 줄지 않으니 쓰지 않는다) 그때까지 단추를 막는다. 못 읽으면 `null`(「잠시 뒤에」) - 시간을 모르면 막지 않는다.
 * - `unavailable`(503 `PAYMENT.UNAVAILABLE`): 결제창을 여는 결제사가 없다 - 클라이언트 키가 없을 때와 같은 막힘이다(다시 눌러도 같고 누를 때마다 한도를 쓴다)
 * - `notOffered`: 목록에 없는 금액(422) · `orderFailed`: 그 밖
 */
export type OrderFailure =
  | { kind: 'rateLimited'; until: number | null }
  | { kind: 'unavailable' }
  | { kind: 'notOffered' }
  | { kind: 'orderFailed' }

export function orderFailureOf(error: unknown, now: number): OrderFailure {
  if (isErrorCode(error, ErrorCodes.COMMON_TOO_MANY_REQUESTS)) {
    const seconds = retryAfterSeconds(error)
    return seconds === undefined || seconds <= 0
      ? { kind: 'rateLimited', until: null }
      : { kind: 'rateLimited', until: now + seconds * 1000 }
  }
  if (isErrorCode(error, PaymentLedgerErrorCodes.UNAVAILABLE)) return { kind: 'unavailable' }
  if (isErrorCode(error, PaymentLedgerErrorCodes.ITEM_NOT_PURCHASABLE))
    return { kind: 'notOffered' }
  return { kind: 'orderFailed' }
}
