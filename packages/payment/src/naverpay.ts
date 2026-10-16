/** 네이버페이 결제창 SDK. npm 패키지가 아니라 스크립트다 — 누른 그때 불러온다. 네이버페이는 이 주소로 직접 불러 쓰라고 요구한다(내려받아 우리 서버에 두면 최신 수정이 적용되지 않아 동작을 보장하지 않는다) */
export const NAVERPAY_SDK_URL = 'https://nsp.pay.naver.com/sdk/js/naverpay.min.js'

/** 스크립트가 이 시간(밀리초) 안에 `onload` 도 `onerror` 도 못 주면 포기한다 — 그다음 누름이 다시 시도한다 */
export const NAVERPAY_LOAD_TIMEOUT_MS = 15_000

/** 결제 예약 값(`Naver.Pay.open`)에서 쓰는 만큼만 - 구매자 정보(`merchantUserKey` · `purchaser*`)는 넘기지 않는다 */
export type NaverPayReserve = {
  merchantPayKey: string
  productName: string
  productCount: number
  totalPayAmount: number
  taxScopeAmount: number
  taxExScopeAmount: number
  returnUrl: string
  productItems: {
    categoryType: string
    categoryId: string
    uid: string
    name: string
    count: number
  }[]
}

/** `window.Naver` 중 쓰는 만큼만 */
export type NaverPaySdk = {
  Pay: {
    create(options: {
      mode: 'development' | 'production'
      clientId: string
      chainId: string
      payType: 'normal'
      /** 결제 화면을 같은 창에서 연다(페이지 이동) - 결과는 `returnUrl` 로 붙어 온다 */
      openType: 'page'
    }): { open(reserve: NaverPayReserve): void }
  }
}

type SdkWindow = { Naver?: NaverPaySdk }
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

export type LoadNaverPaySdkEnv = {
  /** 시험용 — 기본은 전역 `window` · `document`. 서버에서는 둘 다 없다 */
  window?: SdkWindow
  document?: SdkDocument
  timeoutMs?: number
}

// window 마다 따로 기억한다(토스 로더처럼) — 모듈 전역에 두면 서버 렌더·시험 사이에 샌다
const loading = new WeakMap<object, Promise<NaverPaySdk>>()

/** 네이버페이 SDK 를 불러온다. 이미 있으면 그대로 쓰고, 불러오는 중이면 같은 약속을 돌려주고, 실패하면 약속을 버려 다음 클릭이 다시 시도한다. 브라우저가 아니면 거절된 약속을 돌려준다 */
export function loadNaverPaySdk(env: LoadNaverPaySdkEnv = {}): Promise<NaverPaySdk> {
  const globals = globalThis as { window?: SdkWindow; document?: SdkDocument }
  const win = 'window' in env ? env.window : globals.window
  const doc = 'document' in env ? env.document : globals.document
  if (!win || !doc)
    return Promise.reject(new Error('The NaverPay SDK can only be loaded in a browser'))
  if (win.Naver) return Promise.resolve(win.Naver)
  const known = loading.get(win)
  if (known) return known

  const timeoutMs = env.timeoutMs ?? NAVERPAY_LOAD_TIMEOUT_MS
  const attempt: { promise?: Promise<NaverPaySdk> } = {}
  const promise = (attempt.promise = new Promise<NaverPaySdk>((resolve, reject) => {
    const script = doc.createElement('script')
    const timer = setTimeout(
      () => fail(`The NaverPay script did not finish loading in ${timeoutMs} ms`),
      timeoutMs,
    )
    const fail = (why: string) => {
      clearTimeout(timer)
      script.remove()
      if (loading.get(win) === attempt.promise) loading.delete(win)
      reject(new Error(why))
    }
    script.src = NAVERPAY_SDK_URL
    script.async = true
    script.onload = () => {
      clearTimeout(timer)
      const sdk = win.Naver
      if (sdk) resolve(sdk)
      else fail('The NaverPay script loaded but window.Naver is missing')
    }
    script.onerror = () => fail(`Could not load the NaverPay script (${NAVERPAY_SDK_URL})`)
    doc.head.appendChild(script as never)
  }))
  loading.set(win, promise)
  return promise
}

/** 서버가 준 네이버페이 결제창 값(`checkout.attributes`) - 모두 공개 값이다(시크릿은 서버에만 있다) */
export type NaverPayAttributes = {
  chainId?: string
  /** `development` | `production` - 서버 설정의 모드 */
  mode?: string
  /** 결제를 마친 구매자가 돌아올 주소 - 서버 설정이다(`kind=NAVERPAY_SDK&provider=…&order=…` 조각이 붙어 있다) */
  returnUrl?: string
  taxScopeAmount?: string
  taxExScopeAmount?: string
}

export type OpenNaverPayInput = {
  clientId: string | null
  attributes: NaverPayAttributes | undefined
  orderId: string
  orderName: string
  amount: number
  loadSdk?: () => Promise<NaverPaySdk>
}

/** 구매자를 보낼 수 있는 주소 - http(s) 절대 주소만(`javascript:` · `data:` 같은 것을 서버 답이 망가졌어도 따라가지 않는다) */
export function isWebAddress(value: string | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

const MODES = new Set(['development', 'production'])
const wholeNumber = (value: string | undefined) =>
  value !== undefined && /^\d+$/.test(value) ? Number(value) : null

/**
 * 결제창을 여는 데 필요한 값이 다 있는가 - 있으면 SDK 에 넘길 값을, 없으면 이유(영문 한 줄)를 돌려준다. `openCheckout` 은 이유를 던지고 `checkoutCanOpen` 은 「열 수 없다」로 말한다.
 * 과세 + 면세는 결제 금액과 같아야 한다 - 서버가 정한 구분이 어긋났으면 네이버페이에 보내지 않는다.
 */
export function naverPayWindowOf(input: Omit<OpenNaverPayInput, 'loadSdk'>):
  | {
      ok: true
      mode: 'development' | 'production'
      clientId: string
      chainId: string
      returnUrl: string
      taxScopeAmount: number
      taxExScopeAmount: number
    }
  | { ok: false; why: string } {
  const attributes = input.attributes
  if (!input.clientId) return { ok: false, why: 'The checkout has no client id' }
  if (!attributes?.chainId) return { ok: false, why: 'The checkout has no chain id' }
  if (!attributes.mode || !MODES.has(attributes.mode))
    return { ok: false, why: 'The checkout has no known NaverPay mode' }
  if (!isWebAddress(attributes.returnUrl))
    return { ok: false, why: 'The checkout has no http(s) return address' }
  const taxScopeAmount = wholeNumber(attributes.taxScopeAmount)
  const taxExScopeAmount = wholeNumber(attributes.taxExScopeAmount)
  if (
    taxScopeAmount === null ||
    taxExScopeAmount === null ||
    taxScopeAmount + taxExScopeAmount !== input.amount
  )
    return { ok: false, why: 'The checkout tax split does not add up to the amount' }
  return {
    ok: true,
    mode: attributes.mode as 'development' | 'production',
    clientId: input.clientId,
    chainId: attributes.chainId,
    returnUrl: attributes.returnUrl,
    taxScopeAmount,
    taxExScopeAmount,
  }
}

/**
 * 네이버페이 결제창을 연다 - **서버가 만든 주문의 값만** 넘긴다(주문 id · 이름 · 금액 · 과세 구분 · 돌아올 주소). 결제창은 같은 창에서 열리고(페이지 이동) 결과는 서버가 정한 돌아올 주소로 붙어 온다.
 * 값이 모자라면 스크립트를 부르기 전에 던진다. 주의: 승인 API 는 금액을 받지 않아 **금액은 이 창이 정한다** - 서버가 승인 응답의 총액을 주문과 대조한다.
 */
export async function openNaverPayCheckout(input: OpenNaverPayInput): Promise<void> {
  const window = naverPayWindowOf(input)
  if (!window.ok) throw new Error(window.why)
  const Naver = await (input.loadSdk ?? loadNaverPaySdk)()
  Naver.Pay.create({
    mode: window.mode,
    clientId: window.clientId,
    chainId: window.chainId,
    payType: 'normal',
    openType: 'page',
  }).open({
    merchantPayKey: input.orderId,
    productName: input.orderName,
    productCount: 1,
    totalPayAmount: input.amount,
    taxScopeAmount: window.taxScopeAmount,
    taxExScopeAmount: window.taxExScopeAmount,
    returnUrl: window.returnUrl,
    productItems: [
      {
        categoryType: 'ETC',
        categoryId: 'ETC',
        uid: input.orderId,
        name: input.orderName,
        count: 1,
      },
    ],
  })
}
