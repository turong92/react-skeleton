/** Paddle.js v2 (결제창 오버레이). npm 패키지가 아니라 스크립트다 — 누른 그때 불러온다 */
export const PADDLE_SDK_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js'

/** 스크립트가 이 시간(밀리초) 안에 `onload` 도 `onerror` 도 못 주면 포기한다 — 그다음 누름이 다시 시도한다 */
export const PADDLE_LOAD_TIMEOUT_MS = 15_000

/** `window.Paddle` 중 쓰는 만큼만 */
export type PaddleSdk = {
  Environment: { set(environment: 'sandbox' | 'production'): void }
  Initialize(options: { token: string; eventCallback?: (event: { name?: string }) => void }): void
  Checkout: {
    open(options: {
      items: { priceId: string; quantity: number }[]
      customData?: Record<string, string>
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

/** 서버가 준 Paddle 결제창 값(`checkout.attributes` · `billingAuth.attributes`). `customData` 는 JSON 문자열 — 서버가 정하고 우리는 그대로 넘긴다 */
export type PaddleAttributes = { environment?: string; priceId?: string; customData?: string }

export type OpenPaddleInput = {
  clientToken: string | null
  attributes: PaddleAttributes
  /** 결제가 끝나면 Paddle 이 보낼 주소 — 프론트가 정한다. 결제 결과는 웹훅으로 서버에 닿으므로 이 주소의 화면은 서버를 되묻는다 */
  successUrl: string
  locale?: string
  loadSdk?: () => Promise<PaddleSdk>
}

function customDataOf(text: string | undefined): Record<string, string> {
  if (!text) return {}
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new Error('The Paddle custom data is not an object')
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]))
}

/**
 * Paddle 결제창(오버레이)을 연다 — 가격 id 와 우리가 심을 `customData`(계정 · 주문/구독 id)는 서버가 정해 준 값 그대로다. 약속은 창이 **열리면** 끝난다(결제 완료는 알리지 않는다 —
 * 서버가 웹훅으로 안다). 클라이언트 토큰이나 가격 id 가 없으면 스크립트를 부르기 전에 던진다.
 */
export async function openPaddleCheckout({
  clientToken,
  attributes,
  successUrl,
  locale,
  loadSdk = loadPaddleSdk,
}: OpenPaddleInput): Promise<void> {
  if (!clientToken) throw new Error('The checkout has no client token')
  if (!attributes.priceId) throw new Error('The checkout has no Paddle price')
  const customData = customDataOf(attributes.customData)
  const Paddle = await loadSdk()
  if (attributes.environment === 'sandbox') Paddle.Environment.set('sandbox')
  Paddle.Initialize({ token: clientToken })
  Paddle.Checkout.open({
    items: [{ priceId: attributes.priceId, quantity: 1 }],
    customData,
    settings: { displayMode: 'overlay', successUrl, ...(locale ? { locale } : {}) },
  })
}
