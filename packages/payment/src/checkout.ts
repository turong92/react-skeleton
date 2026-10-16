import type { Checkout } from './ledgerTypes'
import { easyPaysOfCheckout } from './easyPay'
import { openPaddleCheckout, type PaddleSdk } from './paddle'

export type { Checkout } from './ledgerTypes'

/** 토스페이먼츠 SDK v2 (결제창 · API 개별 연동). npm 패키지가 아니라 스크립트다 — 누른 그때 불러온다 */
export const TOSS_SDK_URL = 'https://js.tosspayments.com/v2/standard'

/** `window.TossPayments` 중 쓰는 만큼만 */
export type TossPaymentsFactory = ((clientKey: string) => {
  payment(options: { customerKey: string }): {
    requestPayment(request: {
      method: 'CARD'
      amount: { currency: string; value: number }
      orderId: string
      orderName: string
      successUrl: string
      failUrl: string
      /** 간편결제 앱을 바로 연다(`DIRECT`). 없으면 통합 결제창 */
      card?: { flowMode: 'DIRECT'; easyPay: string }
    }): Promise<void>
    /** 카드 등록 창(자동결제) — `openBillingAuth`. 성공하면 `successUrl` 에 `authKey` · `customerKey` 가 붙는다 */
    requestBillingAuth(request: {
      method: 'CARD'
      successUrl: string
      failUrl: string
    }): Promise<void>
  }
}) & { ANONYMOUS: string }

/** 스크립트가 이 시간(밀리초) 안에 `onload` 도 `onerror` 도 못 주면 포기한다 — 그다음 누름이 다시 시도한다 */
export const SDK_LOAD_TIMEOUT_MS = 15_000

type SdkWindow = { TossPayments?: TossPaymentsFactory }
type SdkDocument = {
  createElement(tag: 'script'): {
    src: string
    async: boolean
    onload: (() => void) | null
    onerror: (() => void) | null
    remove(): void
  }
  head: { appendChild(node: never): unknown }
}

export type LoadTossPaymentsSdkEnv = {
  /** 시험용 — 기본은 전역 `window` · `document`. 서버에서는 둘 다 없다 */
  window?: SdkWindow
  document?: SdkDocument
  timeoutMs?: number
}

// window 마다 따로 기억한다(형제 captcha-turnstile 처럼) — 모듈 전역에 두면 서버 렌더·시험 사이에 샌다
const loading = new WeakMap<object, Promise<TossPaymentsFactory>>()

/**
 * 토스 SDK 스크립트를 불러온다. 이미 있으면 그대로 쓰고, 불러오는 중이면 같은 약속을 돌려주고, 실패(오류 · 제한 시간 · 전역 없음)하면
 * 붙인 `<script>` 를 떼고 약속을 버려 다음 클릭이 다시 시도한다. 브라우저가 아니면(서버) 던지지 않고 거절된 약속을 돌려준다.
 */
export function loadTossPaymentsSdk(
  env: LoadTossPaymentsSdkEnv = {},
): Promise<TossPaymentsFactory> {
  const globals = globalThis as { window?: SdkWindow; document?: SdkDocument }
  const win = 'window' in env ? env.window : globals.window
  const doc = 'document' in env ? env.document : globals.document
  if (!win || !doc)
    return Promise.reject(new Error('The TossPayments SDK can only be loaded in a browser'))
  if (win.TossPayments) return Promise.resolve(win.TossPayments)
  const known = loading.get(win)
  if (known) return known

  const timeoutMs = env.timeoutMs ?? SDK_LOAD_TIMEOUT_MS
  const attempt: { promise?: Promise<TossPaymentsFactory> } = {}
  const promise = (attempt.promise = new Promise<TossPaymentsFactory>((resolve, reject) => {
    const script = doc.createElement('script')
    const timer = setTimeout(
      () => fail(`The TossPayments script did not finish loading in ${timeoutMs} ms`),
      timeoutMs,
    )
    const fail = (why: string) => {
      clearTimeout(timer)
      script.remove()
      // 포기한 시도의 늦은 이벤트가 그 뒤에 시작한 새 시도의 기억을 지우지 않게 — 내 약속일 때만 지운다
      if (loading.get(win) === attempt.promise) loading.delete(win)
      reject(new Error(why))
    }
    script.src = TOSS_SDK_URL
    script.async = true
    script.onload = () => {
      clearTimeout(timer)
      const sdk = win.TossPayments
      if (sdk) resolve(sdk)
      else fail('The TossPayments script loaded but window.TossPayments is missing')
    }
    script.onerror = () => fail(`Could not load the TossPayments script (${TOSS_SDK_URL})`)
    doc.head.appendChild(script as never)
  }))
  loading.set(win, promise)
  return promise
}

/** 구매자를 이 주소로 보낼 수 있는가 - http(s) 절대 주소만(`javascript:` · `data:` 같은 것을 서버 답이 망가졌어도 따라가지 않는다) */
function webAddress(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : null
  } catch {
    return null
  }
}

/**
 * 화면이 이 결제창을 **열 수 있는가** - 토스 · Paddle 은 서버가 준 공개 키가 있어야 하고(없으면 결제창을 열 수 없다는 서버의 말이다), 카카오페이 · 네이버페이는 공개 키가 없고 그 몫으로 결제창 주소가 있어야 한다.
 * 열 수 없으면 주문을 돌려놓고 「지금은 결제할 수 없어요」로 말한다.
 */
export function checkoutCanOpen(checkout: Checkout): boolean {
  if (checkout.kind === 'KAKAOPAY_REDIRECT')
    return (
      webAddress(checkout.attributes?.pcUrl) !== null &&
      webAddress(checkout.attributes?.mobileUrl) !== null
    )
  if (checkout.kind === 'NAVERPAY_REDIRECT')
    return webAddress(checkout.attributes?.windowUrl) !== null
  return Boolean(checkout.clientKey)
}

export type OpenCheckoutOptions = {
  /** 결제 성공 뒤 돌아올 주소 — 프론트가 정한다(서버는 받지도 저장하지도 않는다). `readCheckoutReturn` 이 읽는다 */
  successUrl: string
  failUrl: string
  /** SDK 를 불러오는 함수 — 시험 · 스토리에서 가짜로 바꾼다 */
  loadSdk?: () => Promise<TossPaymentsFactory>
  /** 토스 결제창에서 이 간편결제 앱을 바로 연다(`NAVERPAY` …). 이 결제창 값(`attributes.easyPays`)에 없는 코드면 던진다. 없으면 통합 결제창 */
  easyPay?: string
  /** Paddle.js 를 불러오는 함수 — 시험 · 스토리에서 가짜로 바꾼다 */
  loadPaddle?: () => Promise<PaddleSdk>
  /** Paddle 결제창 언어 */
  locale?: string
  /** 카카오페이 · 네이버페이: 구매자를 결제창 주소로 보내는 함수 - 기본은 현재 창을 옮긴다(`location.assign`). 시험 · 스토리에서 바꾼다 */
  navigate?: (url: string) => void
  /** 카카오페이: 모바일 기기인가 - 기본은 `navigator.userAgent` 로 본다. 모바일이면 모바일 주소, 아니면 PC 주소 */
  isMobile?: () => boolean
}

const MOBILE_AGENT = /Android|iPhone|iPad|iPod|Mobile/i
const defaultIsMobile = () =>
  typeof navigator !== 'undefined' && MOBILE_AGENT.test(navigator.userAgent ?? '')
const defaultNavigate = (url: string) => {
  window.location.assign(url)
}

/**
 * `checkout.kind` 로 갈라 결제창을 연다. 브라우저 전역은 이 함수 안에서만 읽는다(import 때는 건드리지 않는다 — SSR 안전).
 * `TOSS_PAYMENT_WINDOW`: 구매자 이름 · 이메일 · 전화번호는 넘기지 않는다(선택 칸이다). 결제창이 주소를 바꾸면 약속은 끝나지 않을 수 있고,
 * 사용자가 창을 닫으면 SDK 가 던진 에러(`code: 'USER_CANCEL'` 등)가 그대로 나온다.
 */
export async function openCheckout(
  checkout: Checkout,
  {
    successUrl,
    failUrl,
    easyPay,
    loadSdk = loadTossPaymentsSdk,
    loadPaddle,
    locale,
    navigate = defaultNavigate,
    isMobile = defaultIsMobile,
  }: OpenCheckoutOptions,
): Promise<void> {
  switch (checkout.kind) {
    case 'TOSS_PAYMENT_WINDOW': {
      // 결제사 모듈이 키를 정하지 못하면 서버가 `null` 을 준다 - SDK 에 `null` 을 넘기지 않고, 스크립트도 불러오기 전에 멈춘다
      if (!checkout.clientKey) throw new Error('The checkout has no client key')
      // 서버가 이 결제창에 허락하지 않은 간편결제는 열지 않는다 - 화면이 오래된 설정 응답으로 단추를 그렸어도 여기서 멈춘다
      if (easyPay !== undefined && !easyPaysOfCheckout(checkout).includes(easyPay))
        throw new Error(`The checkout does not offer the easy pay ${easyPay}`)
      const TossPayments = await loadSdk()
      await TossPayments(checkout.clientKey)
        .payment({ customerKey: TossPayments.ANONYMOUS })
        .requestPayment({
          method: 'CARD',
          amount: { currency: checkout.amount.currency, value: checkout.amount.amount },
          orderId: checkout.orderId,
          orderName: checkout.orderName,
          successUrl,
          failUrl,
          ...(easyPay !== undefined ? { card: { flowMode: 'DIRECT' as const, easyPay } } : {}),
        })
      return
    }
    case 'PADDLE_CHECKOUT':
      if (easyPay !== undefined)
        throw new Error(`The checkout does not offer the easy pay ${easyPay}`)
      // Paddle 은 실패 주소가 없다 - 창을 닫으면 아무 일도 일어나지 않고, 열린 주문은 서버의 만료 작업이 닫는다
      return openPaddleCheckout({
        clientToken: checkout.clientKey,
        attributes: checkout.attributes,
        successUrl,
        ...(locale ? { locale } : {}),
        ...(loadPaddle ? { loadSdk: loadPaddle } : {}),
      })
    case 'KAKAOPAY_REDIRECT': {
      // 카카오페이에는 카드 단추 · 간편결제 단추가 따로 없다 - 조용히 버리지 않고 토스 쪽과 같이 던진다
      if (easyPay !== undefined)
        throw new Error(`The checkout does not offer the easy pay ${easyPay}`)
      const address = webAddress(
        isMobile() ? checkout.attributes?.mobileUrl : checkout.attributes?.pcUrl,
      )
      if (address === null)
        throw new Error('The checkout has no http(s) address to send the buyer to')
      // 돌아오는 주소는 서버 설정이다(`ready` 때 카카오페이가 받았다) - successUrl · failUrl 은 쓰지 않는다
      navigate(address)
      return
    }
    case 'NAVERPAY_REDIRECT': {
      // 네이버페이에는 간편결제 단추가 따로 없다 - 조용히 버리지 않고 토스 쪽과 같이 던진다
      if (easyPay !== undefined)
        throw new Error(`The checkout does not offer the easy pay ${easyPay}`)
      const address = webAddress(checkout.attributes?.windowUrl)
      if (address === null)
        throw new Error('The checkout has no http(s) address to send the buyer to')
      // 돌아오는 주소는 서버 설정이다(결제 예약 때 네이버페이가 받았다) - successUrl · failUrl 은 쓰지 않는다
      navigate(address)
      return
    }
    default:
      throw new Error(`Unknown checkout kind: ${String((checkout as { kind: unknown }).kind)}`)
  }
}
