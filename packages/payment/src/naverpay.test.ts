import { describe, expect, it, vi } from 'vitest'
import { checkoutCanOpen, openCheckout, type Checkout } from './checkout'
import { loadNaverPaySdk, NAVERPAY_SDK_URL, type NaverPaySdk } from './naverpay'

const checkout: Checkout = {
  provider: 'naverpay',
  kind: 'NAVERPAY_SDK',
  clientKey: 'CLIENTID',
  testMode: true,
  orderId: 'ord_1',
  orderName: '응원하기 3,000원',
  amount: { amount: 3000, currency: 'KRW' },
  attributes: {
    chainId: 'CHAINID',
    mode: 'development',
    returnUrl:
      'https://app.example/payments/return?kind=NAVERPAY_SDK&provider=naverpay&order=ord_1',
    taxScopeAmount: '3000',
    taxExScopeAmount: '0',
  },
}

function fakeSdk() {
  const seen = { created: undefined as unknown, opened: undefined as unknown }
  const sdk: NaverPaySdk = {
    Pay: {
      create: (options) => {
        seen.created = options
        return {
          open: (reserve) => {
            seen.opened = reserve
          },
        }
      },
    },
  }
  return { sdk, seen }
}

describe('openCheckout — NAVERPAY_SDK', () => {
  it('creates the SDK with the server-given ids and mode and opens the window with the order the server made - no buyer information', async () => {
    const { sdk, seen } = fakeSdk()
    await openCheckout(checkout, {
      successUrl: 'unused',
      failUrl: 'unused',
      loadNaverPay: async () => sdk,
    })
    expect(seen.created).toEqual({
      mode: 'development',
      clientId: 'CLIENTID',
      chainId: 'CHAINID',
      payType: 'normal',
      openType: 'page',
    })
    // toEqual is exact: any extra key (merchantUserKey, purchaserName, purchaserBirthday …) fails this
    expect(seen.opened).toEqual({
      merchantPayKey: 'ord_1',
      productName: '응원하기 3,000원',
      productCount: 1,
      totalPayAmount: 3000,
      taxScopeAmount: 3000,
      taxExScopeAmount: 0,
      returnUrl: checkout.attributes?.returnUrl,
      productItems: [
        {
          categoryType: 'ETC',
          categoryId: 'ETC',
          uid: 'ord_1',
          name: '응원하기 3,000원',
          count: 1,
        },
      ],
    })
  })

  it('returns to the address the server configured, never to the successUrl the screen made up', async () => {
    const { sdk, seen } = fakeSdk()
    await openCheckout(checkout, {
      successUrl: 'https://evil.example/ok',
      failUrl: 'https://evil.example/fail',
      loadNaverPay: async () => sdk,
    })
    expect((seen.opened as { returnUrl: string }).returnUrl).toBe(checkout.attributes?.returnUrl)
  })

  it('does not even load the script when the checkout is missing a piece (id, chain, mode, return address, tax split that adds up) - nothing opens', async () => {
    const loadNaverPay = vi.fn()
    const options = { successUrl: 's', failUrl: 'f', loadNaverPay }
    const broken = (
      patch: Partial<NonNullable<Extract<Checkout, { kind: 'NAVERPAY_SDK' }>['attributes']>>,
      clientKey: string | null = 'CLIENTID',
    ): Checkout =>
      ({ ...checkout, clientKey, attributes: { ...checkout.attributes, ...patch } }) as Checkout
    await expect(openCheckout(broken({}, null), options)).rejects.toThrow(/client id/)
    await expect(openCheckout(broken({ chainId: '' }), options)).rejects.toThrow(/chain id/)
    await expect(openCheckout(broken({ mode: 'sandbox' }), options)).rejects.toThrow(/mode/)
    await expect(
      openCheckout(broken({ returnUrl: 'javascript:alert(1)' }), options),
    ).rejects.toThrow(/return address/)
    await expect(openCheckout(broken({ taxScopeAmount: '1000' }), options)).rejects.toThrow(/tax/)
    expect(loadNaverPay).not.toHaveBeenCalled()
  })

  it('does not offer an easy pay button choice - NaverPay has none, and the request throws instead of dropping it', async () => {
    const loadNaverPay = vi.fn()
    await expect(
      openCheckout(checkout, { successUrl: 's', failUrl: 'f', easyPay: 'NAVERPAY', loadNaverPay }),
    ).rejects.toThrow(/NAVERPAY/)
    expect(loadNaverPay).not.toHaveBeenCalled()
  })
})

describe('checkoutCanOpen — NAVERPAY_SDK', () => {
  it('needs the public ids, a known mode and an http(s) return address - the client key is present here, so it is not the only thing to look at', () => {
    expect(checkoutCanOpen(checkout)).toBe(true)
    expect(checkoutCanOpen({ ...checkout, clientKey: null } as Checkout)).toBe(false)
    expect(
      checkoutCanOpen({
        ...checkout,
        attributes: { ...checkout.attributes, chainId: undefined },
      } as Checkout),
    ).toBe(false)
    expect(
      checkoutCanOpen({
        ...checkout,
        attributes: { ...checkout.attributes, returnUrl: 'data:text/html,x' },
      } as Checkout),
    ).toBe(false)
  })
})

describe('loadNaverPaySdk', () => {
  type Script = {
    src: string
    async: boolean
    onload: (() => void) | null
    onerror: (() => void) | null
    remove: () => void
  }
  function environment() {
    const scripts: Script[] = []
    const win: { Naver?: NaverPaySdk } = {}
    const doc = {
      createElement: () => {
        const script: Script = {
          src: '',
          async: false,
          onload: null,
          onerror: null,
          remove: vi.fn(),
        }
        scripts.push(script)
        return script
      },
      head: { appendChild: vi.fn() },
    }
    return { scripts, win, doc }
  }

  it('loads the script from the address NaverPay requires (never a copy), once for concurrent calls, and resolves with window.Naver', async () => {
    const { scripts, win, doc } = environment()
    const first = loadNaverPaySdk({ window: win, document: doc })
    const second = loadNaverPaySdk({ window: win, document: doc })
    expect(scripts).toHaveLength(1)
    expect(scripts[0]?.src).toBe(NAVERPAY_SDK_URL)
    expect(NAVERPAY_SDK_URL).toBe('https://nsp.pay.naver.com/sdk/js/naverpay.min.js')
    const { sdk } = fakeSdk()
    win.Naver = sdk
    scripts[0]?.onload?.()
    await expect(first).resolves.toBe(sdk)
    await expect(second).resolves.toBe(sdk)
  })

  it('a failed load removes the script and the next press tries again', async () => {
    const { scripts, win, doc } = environment()
    const first = loadNaverPaySdk({ window: win, document: doc })
    scripts[0]?.onerror?.()
    await expect(first).rejects.toThrow(/NaverPay/)
    expect(scripts[0]?.remove).toHaveBeenCalled()
    void loadNaverPaySdk({ window: win, document: doc })
    expect(scripts).toHaveLength(2)
  })

  it('rejects when there is no browser (server render)', async () => {
    await expect(loadNaverPaySdk({ window: undefined, document: undefined })).rejects.toThrow(
      'browser',
    )
  })
})
