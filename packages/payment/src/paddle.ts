/** Paddle.js v2 (결제창 오버레이). npm 패키지가 아니라 스크립트다 — 누른 그때 불러온다 */
export const PADDLE_SDK_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js'

/** 스크립트가 이 시간(밀리초) 안에 `onload` 도 `onerror` 도 못 주면 포기한다 — 그다음 누름이 다시 시도한다 */
export const PADDLE_LOAD_TIMEOUT_MS = 15_000

/** `window.Paddle` 중 쓰는 만큼만 */
export type PaddleSdk = {
  Environment: { set(environment: 'sandbox' | 'production'): void }
  Initialize(options: { token: string; eventCallback?: (event: { name?: string }) => void }): void
  /** 구매자 위치의 통화로 환산한 표시 금액 - 위치를 안 주면 Paddle.js 가 IP 로 정한다 */
  PricePreview(request: { items: { priceId: string; quantity: number }[] }): Promise<{
    data: {
      details: { lineItems: { price: { id: string }; formattedTotals: { total: string } }[] }
    }
  }>
  Checkout: {
    open(options: {
      transactionId: string
      settings?: { displayMode?: 'overlay'; successUrl?: string; locale?: string }
    }): void
  }
}

type SdkWindow = { Paddle?: PaddleSdk }
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

export type LoadPaddleSdkEnv = {
  /** 시험용 — 기본은 전역 `window` · `document`. 서버에서는 둘 다 없다 */
  window?: SdkWindow
  document?: SdkDocument
  timeoutMs?: number
}

// window 마다 따로 기억한다(토스 로더처럼) — 모듈 전역에 두면 서버 렌더·시험 사이에 샌다
const loading = new WeakMap<object, Promise<PaddleSdk>>()

/** Paddle.js 를 불러온다. 이미 있으면 그대로 쓰고, 불러오는 중이면 같은 약속을 돌려주고, 실패하면 약속을 버려 다음 클릭이 다시 시도한다. 브라우저가 아니면 거절된 약속을 돌려준다 */
export function loadPaddleSdk(env: LoadPaddleSdkEnv = {}): Promise<PaddleSdk> {
  const globals = globalThis as { window?: SdkWindow; document?: SdkDocument }
  const win = 'window' in env ? env.window : globals.window
  const doc = 'document' in env ? env.document : globals.document
  if (!win || !doc) return Promise.reject(new Error('Paddle.js can only be loaded in a browser'))
  if (win.Paddle) return Promise.resolve(win.Paddle)
  const known = loading.get(win)
  if (known) return known

  const timeoutMs = env.timeoutMs ?? PADDLE_LOAD_TIMEOUT_MS
  const attempt: { promise?: Promise<PaddleSdk> } = {}
  const promise = (attempt.promise = new Promise<PaddleSdk>((resolve, reject) => {
    const script = doc.createElement('script')
    const timer = setTimeout(
      () => fail(`The Paddle.js script did not finish loading in ${timeoutMs} ms`),
      timeoutMs,
    )
    const fail = (why: string) => {
      clearTimeout(timer)
      script.remove()
      if (loading.get(win) === attempt.promise) loading.delete(win)
      reject(new Error(why))
    }
    script.src = PADDLE_SDK_URL
    script.async = true
    script.onload = () => {
      clearTimeout(timer)
      const sdk = win.Paddle
      if (sdk) resolve(sdk)
      else fail('The Paddle.js script loaded but window.Paddle is missing')
    }
    script.onerror = () => fail(`Could not load the Paddle.js script (${PADDLE_SDK_URL})`)
    doc.head.appendChild(script as never)
  }))
  loading.set(win, promise)
  return promise
}

/** 서버가 준 Paddle 결제창 값(`checkout.attributes` · `billingAuth.attributes`) - 서버가 Paddle 에 미리 만든 **거래 id** 가 전부다. 가격 · 수량 · 우리 줄 id 는 거래에 서버가 넣었다 */
export type PaddleAttributes = { environment?: string; transactionId?: string }

export type OpenPaddleInput = {
  clientToken: string | null
  attributes: PaddleAttributes
  /** 결제가 끝나면 Paddle 이 보낼 주소 - 프론트가 정한다. 결제 결과는 웹훅으로 서버에 닿으므로 이 주소의 화면은 서버를 되묻는다 */
  successUrl: string
  locale?: string
  loadSdk?: () => Promise<PaddleSdk>
}

/**
 * Paddle 결제창(오버레이)을 연다 - **서버가 만든 거래 id 만** 넘긴다(가격 · customData 를 브라우저가 정하지 않는다). 약속은 창이 **열리면** 끝난다(완료는 알리지 않는다 - 서버가 웹훅으로 안다).
 * 클라이언트 토큰이나 거래 id 가 없으면 스크립트를 부르기 전에 던진다.
 */
export async function openPaddleCheckout({
  clientToken,
  attributes,
  successUrl,
  locale,
  loadSdk = loadPaddleSdk,
}: OpenPaddleInput): Promise<void> {
  if (!clientToken) throw new Error('The checkout has no client token')
  if (!attributes.transactionId) throw new Error('The checkout has no Paddle transaction')
  const Paddle = await loadSdk()
  if (attributes.environment === 'sandbox') Paddle.Environment.set('sandbox')
  Paddle.Initialize({ token: clientToken })
  Paddle.Checkout.open({
    transactionId: attributes.transactionId,
    settings: { displayMode: 'overlay', successUrl, ...(locale ? { locale } : {}) },
  })
}

/** `GET /config` 의 `pricePreviews.paddle` - 상품 · 플랜 코드 → Paddle 가격 id 와 공개 토큰 */
export type PaddlePricePreviewConfig = {
  clientToken: string
  environment: string
  prices: Readonly<Record<string, string>>
}

/**
 * 가격 미리보기 - 구매자 위치의 통화로 환산된 **실제 결제 금액**(세금 포함 합계, 예 `$3.99`)을 코드별로 돌려준다. 우리 표의 금액이 아니라 Paddle 가격이 결제 금액이다.
 * 실패하면 거절한다 - 화면은 틀린 금액 대신 금액을 숨긴다. 응답에 없는 코드는 결과에서 빠진다.
 */
export async function previewPaddlePrices({
  clientToken,
  environment,
  prices,
  loadSdk = loadPaddleSdk,
}: PaddlePricePreviewConfig & { loadSdk?: () => Promise<PaddleSdk> }): Promise<
  Record<string, string>
> {
  const Paddle = await loadSdk()
  if (environment === 'sandbox') Paddle.Environment.set('sandbox')
  Paddle.Initialize({ token: clientToken })
  const priceIds = [...new Set(Object.values(prices))]
  const result = await Paddle.PricePreview({
    items: priceIds.map((priceId) => ({ priceId, quantity: 1 })),
  })
  const totals = new Map(
    result.data.details.lineItems.map((line) => [line.price.id, line.formattedTotals.total]),
  )
  const shown: Record<string, string> = {}
  for (const [code, priceId] of Object.entries(prices)) {
    const total = totals.get(priceId)
    if (total) shown[code] = total
  }
  return shown
}
