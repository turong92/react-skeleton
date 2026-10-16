import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadTossPaymentsSdk,
  openCheckout,
  SDK_LOAD_TIMEOUT_MS,
  TOSS_SDK_URL,
  type Checkout,
  type TossPaymentsFactory,
} from './checkout'

const checkout: Checkout = {
  provider: 'toss',
  kind: 'TOSS_PAYMENT_WINDOW',
  clientKey: 'test_ck_abc',
  testMode: true,
  orderId: 'ord_1',
  orderName: '응원하기 3,000원',
  amount: { amount: 3000, currency: 'KRW' },
}

function fakeSdk() {
  const seen = {
    clientKey: undefined as string | undefined,
    paymentOptions: undefined as unknown,
    request: undefined as unknown,
  }
  const factory = Object.assign(
    (clientKey: string) => {
      seen.clientKey = clientKey
      return {
        payment: (options: unknown) => {
          seen.paymentOptions = options
          return {
            requestPayment: async (request: unknown) => {
              seen.request = request
            },
          }
        },
      }
    },
    { ANONYMOUS: '@@ANONYMOUS' },
  ) as unknown as TossPaymentsFactory
  return { factory, seen }
}

afterEach(() => vi.unstubAllGlobals())

describe('openCheckout — TOSS_PAYMENT_WINDOW', () => {
  it('calls the SDK exactly as the backend contract says and passes no buyer information', async () => {
    const { factory, seen } = fakeSdk()
    await openCheckout(checkout, {
      successUrl: 'https://app.example/payments/return',
      failUrl: 'https://app.example/payments/return?failed=1',
      loadSdk: async () => factory,
    })
    expect(seen.clientKey).toBe('test_ck_abc')
    expect(seen.paymentOptions).toEqual({ customerKey: '@@ANONYMOUS' })
    // toEqual is exact: any extra key (customerName, customerEmail, customerMobilePhone …) fails this
    expect(seen.request).toEqual({
      method: 'CARD',
      amount: { currency: 'KRW', value: 3000 },
      orderId: 'ord_1',
      orderName: '응원하기 3,000원',
      successUrl: 'https://app.example/payments/return',
      failUrl: 'https://app.example/payments/return?failed=1',
    })
  })

  it('with an easy pay it opens that app directly (card.flowMode DIRECT) and changes nothing else', async () => {
    const { factory, seen } = fakeSdk()
    await openCheckout(
      { ...checkout, attributes: { method: 'CARD', easyPays: 'NAVERPAY,KAKAOPAY' } },
      { successUrl: 's', failUrl: 'f', easyPay: 'KAKAOPAY', loadSdk: async () => factory },
    )
    expect(seen.request).toEqual({
      method: 'CARD',
      amount: { currency: 'KRW', value: 3000 },
      orderId: 'ord_1',
      orderName: '응원하기 3,000원',
      successUrl: 's',
      failUrl: 'f',
      card: { flowMode: 'DIRECT', easyPay: 'KAKAOPAY' },
    })
  })

  it('refuses an easy pay the server did not offer in this checkout, before loading the SDK', async () => {
    const loadSdk = vi.fn(async () => fakeSdk().factory)
    await expect(
      openCheckout(
        { ...checkout, attributes: { method: 'CARD', easyPays: 'NAVERPAY' } },
        { successUrl: 's', failUrl: 'f', easyPay: 'KAKAOPAY', loadSdk },
      ),
    ).rejects.toThrow(/KAKAOPAY/)
    await expect(
      openCheckout(checkout, { successUrl: 's', failUrl: 'f', easyPay: 'KAKAOPAY', loadSdk }),
    ).rejects.toThrow(/KAKAOPAY/)
    expect(loadSdk).not.toHaveBeenCalled()
  })

  it('throws on a kind it does not know, without loading anything', async () => {
    const loadSdk = vi.fn()
    await expect(
      openCheckout({ ...checkout, kind: 'SOMETHING_NEW' } as unknown as Checkout, {
        successUrl: 's',
        failUrl: 'f',
        loadSdk,
      }),
    ).rejects.toThrow(/SOMETHING_NEW/)
    expect(loadSdk).not.toHaveBeenCalled()
  })

  it("lets the SDK's own rejection (user closed the window, …) reach the caller", async () => {
    const factory = Object.assign(
      () => ({
        payment: () => ({
          requestPayment: async () => {
            throw Object.assign(new Error('closed'), { code: 'USER_CANCEL' })
          },
        }),
      }),
      { ANONYMOUS: 'a' },
    ) as unknown as TossPaymentsFactory
    await expect(
      openCheckout(checkout, { successUrl: 's', failUrl: 'f', loadSdk: async () => factory }),
    ).rejects.toMatchObject({ code: 'USER_CANCEL' })
  })
})

describe('openCheckout — a checkout without a client key', () => {
  it('the backend sends clientKey null when the provider module has none: it refuses before loading the SDK instead of handing null to the SDK', async () => {
    const loadSdk = vi.fn(async () => fakeSdk().factory)
    await expect(
      openCheckout({ ...checkout, clientKey: null }, { successUrl: 's', failUrl: 'f', loadSdk }),
    ).rejects.toThrow(/client key/i)
    expect(loadSdk).not.toHaveBeenCalled()
  })
})

describe('loadTossPaymentsSdk (the default loader — runs only when the button is pressed)', () => {
  type FakeScript = {
    src?: string
    async?: boolean
    onload?: () => void
    onerror?: () => void
    removed: boolean
    remove(): void
  }
  function stubDom() {
    const appended: FakeScript[] = []
    const win: { TossPayments?: unknown } = {}
    vi.stubGlobal('window', win)
    vi.stubGlobal('document', {
      createElement: () => {
        const el: FakeScript = {
          removed: false,
          remove() {
            el.removed = true
          },
        }
        return el
      },
      head: { appendChild: (el: FakeScript) => appended.push(el) },
    })
    return { appended, win }
  }
  const sdkValue = () => Object.assign(() => ({}), { ANONYMOUS: 'a' })

  afterEach(() => vi.useRealTimers())

  it('uses the v2 standard script URL', () => {
    expect(TOSS_SDK_URL).toBe('https://js.tosspayments.com/v2/standard')
  })

  it('adds the script once, resolves with window.TossPayments after it loads, and reuses an already-loaded SDK', async () => {
    const { appended, win } = stubDom()
    const loading = loadTossPaymentsSdk()
    expect(appended).toHaveLength(1)
    expect(appended[0]?.src).toBe(TOSS_SDK_URL)
    const sdk = sdkValue()
    win.TossPayments = sdk
    appended[0]?.onload?.()
    await expect(loading).resolves.toBe(sdk)
    await expect(loadTossPaymentsSdk()).resolves.toBe(sdk)
    expect(appended).toHaveLength(1)
  })

  it('two calls before the script has loaded add one script and share one promise', async () => {
    const { appended, win } = stubDom()
    const first = loadTossPaymentsSdk()
    const second = loadTossPaymentsSdk()
    expect(appended).toHaveLength(1)
    expect(second).toBe(first)
    const sdk = sdkValue()
    win.TossPayments = sdk
    appended[0]?.onload?.()
    await expect(Promise.all([first, second])).resolves.toEqual([sdk, sdk])
  })

  it('rejects when the script fails to load, takes the failed <script> out, and a later press tries again', async () => {
    const { appended } = stubDom()
    const first = loadTossPaymentsSdk()
    appended[0]?.onerror?.()
    await expect(first).rejects.toThrow(/TossPayments/)
    expect(appended[0]?.removed).toBe(true)
    void loadTossPaymentsSdk()
    expect(appended).toHaveLength(2)
  })

  it('rejects when the script loads but window.TossPayments is missing, and removes it too', async () => {
    const { appended } = stubDom()
    const loading = loadTossPaymentsSdk()
    appended[0]?.onload?.()
    await expect(loading).rejects.toThrow(/missing/)
    expect(appended[0]?.removed).toBe(true)
  })

  it('gives up when neither onload nor onerror ever comes, and a later press tries again', async () => {
    vi.useFakeTimers()
    const { appended } = stubDom()
    const loading = loadTossPaymentsSdk()
    const settled = expect(loading).rejects.toThrow(/did not finish/)
    await vi.advanceTimersByTimeAsync(SDK_LOAD_TIMEOUT_MS)
    await settled
    expect(appended[0]?.removed).toBe(true)
    void loadTossPaymentsSdk()
    expect(appended).toHaveLength(2)
  })

  it('a late event from a given-up attempt does not make the loader forget the attempt that replaced it', async () => {
    vi.useFakeTimers()
    const { appended, win } = stubDom()
    const first = loadTossPaymentsSdk()
    const gaveUp = expect(first).rejects.toThrow(/did not finish/)
    await vi.advanceTimersByTimeAsync(SDK_LOAD_TIMEOUT_MS)
    await gaveUp
    const second = loadTossPaymentsSdk()
    expect(appended).toHaveLength(2)
    appended[0]?.onload?.() // the first <script> finally reports in, with no window.TossPayments
    expect(loadTossPaymentsSdk()).toBe(second)
    expect(appended).toHaveLength(2)
    const sdk = sdkValue()
    win.TossPayments = sdk
    appended[1]?.onload?.()
    await expect(second).resolves.toBe(sdk)
  })

  it('on a server (no window) it rejects with a promise instead of throwing a ReferenceError', async () => {
    let returned: Promise<unknown> | undefined
    expect(() => {
      returned = loadTossPaymentsSdk()
    }).not.toThrow()
    await expect(returned).rejects.toThrow(/browser/)
  })

  it('remembers the loading promise per window, not in a module global', () => {
    const first = stubDom()
    const a = loadTossPaymentsSdk()
    const second = stubDom()
    const b = loadTossPaymentsSdk()
    expect(b).not.toBe(a)
    expect(first.appended).toHaveLength(1)
    expect(second.appended).toHaveLength(1)
    void a.catch(() => undefined)
    void b.catch(() => undefined)
  })
})
