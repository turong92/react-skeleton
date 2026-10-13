import { describe, expect, it, vi } from 'vitest'
import { openBillingAuth } from './billingAuth'
import { openCheckout } from './checkout'
import { loadPaddleSdk, openPaddleCheckout, previewPaddlePrices, type PaddleSdk } from './paddle'
import { orderQuery } from './queries'
import { mySubscriptionQuery } from './subscriptionQueries'

function fakePaddle() {
  const calls: unknown[] = []
  const sdk: PaddleSdk = {
    Environment: { set: (environment) => calls.push(['environment', environment]) },
    Initialize: (options) => calls.push(['initialize', options.token]),
    Checkout: { open: (options) => calls.push(['open', options]) },
    PricePreview: (request) => {
      calls.push(['preview', request])
      return Promise.resolve({ data: { details: { lineItems: [] } } })
    },
  }
  return { sdk, calls }
}

const attributes = { environment: 'sandbox', transactionId: 'txn_1' }

describe('openPaddleCheckout', () => {
  it('opens the overlay with the server-made transaction id only, and returns to our address', async () => {
    const { sdk, calls } = fakePaddle()
    await openPaddleCheckout({
      clientToken: 'test_token',
      attributes,
      successUrl: 'https://app.example/payments/return?provider=paddle&order=ord_1',
      loadSdk: () => Promise.resolve(sdk),
    })
    expect(calls).toEqual([
      ['environment', 'sandbox'],
      ['initialize', 'test_token'],
      [
        'open',
        {
          transactionId: 'txn_1',
          settings: {
            displayMode: 'overlay',
            successUrl: 'https://app.example/payments/return?provider=paddle&order=ord_1',
          },
        },
      ],
    ])
  })

  it('does not even load the script without a token or a transaction', async () => {
    const loadSdk = vi.fn()
    await expect(
      openPaddleCheckout({ clientToken: null, attributes, successUrl: '/x', loadSdk }),
    ).rejects.toThrow('client token')
    await expect(
      openPaddleCheckout({ clientToken: 't', attributes: {}, successUrl: '/x', loadSdk }),
    ).rejects.toThrow('transaction')
    expect(loadSdk).not.toHaveBeenCalled()
  })

  it('rejects when there is no browser (server render)', async () => {
    await expect(loadPaddleSdk({ window: undefined, document: undefined })).rejects.toThrow(
      'browser',
    )
  })
})

describe('the provider switch', () => {
  it('opens a Paddle checkout and a Paddle subscription through the same entry points as Toss', async () => {
    const { sdk, calls } = fakePaddle()
    const loadToss = vi.fn()
    await openCheckout(
      {
        provider: 'paddle',
        kind: 'PADDLE_CHECKOUT',
        clientKey: 'tok',
        testMode: true,
        orderId: 'ord_1',
        orderName: 'Cheer',
        amount: { amount: 1000, currency: 'KRW' },
        attributes,
      },
      {
        successUrl: '/ok',
        failUrl: '/fail',
        loadSdk: loadToss,
        loadPaddle: () => Promise.resolve(sdk),
      },
    )
    await openBillingAuth(
      {
        provider: 'paddle',
        kind: 'PADDLE_CHECKOUT',
        clientKey: 'tok',
        testMode: true,
        customerKey: 'cus_1',
        attributes: { ...attributes, transactionId: 'txn_2' },
      },
      {
        successUrl: '/ok',
        failUrl: '/fail',
        loadSdk: loadToss,
        loadPaddle: () => Promise.resolve(sdk),
      },
    )
    expect(loadToss).not.toHaveBeenCalled()
    expect(calls.filter((c) => (c as unknown[])[0] === 'open')).toHaveLength(2)
  })
})

describe('waiting for the webhook', () => {
  const pollOf = (key: ReturnType<typeof orderQuery>['refetchInterval'], data: unknown) =>
    key({ state: { data, dataUpdatedAt: Date.now(), errorUpdatedAt: 0 } } as never)

  it('polls a PENDING order only when told that the result arrives by webhook', () => {
    const api = {} as never
    const pending = { order: { status: 'PENDING' }, refunds: [] }
    expect(pollOf(orderQuery(api, 'o').refetchInterval, pending)).toBe(false)
    expect(pollOf(orderQuery(api, 'o', { untilPaid: true }).refetchInterval, pending)).not.toBe(
      false,
    )
    expect(
      pollOf(orderQuery(api, 'o', { untilPaid: true }).refetchInterval, {
        order: { status: 'PAID' },
        refunds: [],
      }),
    ).toBe(false)
  })

  it('polls "me" while the Paddle subscription is not visible or not active yet', () => {
    const q = mySubscriptionQuery({} as never, { untilActive: true }).refetchInterval
    const poll = (data: unknown) =>
      q({ state: { data, dataUpdatedAt: Date.now(), errorUpdatedAt: 0 } } as never)
    expect(poll({ subscription: null, orders: [] })).not.toBe(false)
    expect(poll({ subscription: { status: 'ACTIVE', pendingPlanCode: null }, orders: [] })).toBe(
      false,
    )
  })
})

describe('previewPaddlePrices', () => {
  const preview = {
    clientToken: 'test_token',
    environment: 'sandbox',
    prices: { basic: 'pri_basic', 'cheer-1000': 'pri_cheer' },
  }

  it('asks Paddle once for every price and maps the formatted totals back to our codes', async () => {
    const { sdk, calls } = fakePaddle()
    sdk.PricePreview = (request) => {
      calls.push(['preview', request])
      return Promise.resolve({
        data: {
          details: {
            lineItems: [
              { price: { id: 'pri_cheer' }, formattedTotals: { total: '$0.99' } },
              { price: { id: 'pri_basic' }, formattedTotals: { total: '$3.99' } },
            ],
          },
        },
      })
    }
    const shown = await previewPaddlePrices({ ...preview, loadSdk: () => Promise.resolve(sdk) })
    expect(shown).toEqual({ basic: '$3.99', 'cheer-1000': '$0.99' })
    expect(calls).toEqual([
      ['environment', 'sandbox'],
      ['initialize', 'test_token'],
      [
        'preview',
        {
          items: [
            { priceId: 'pri_basic', quantity: 1 },
            { priceId: 'pri_cheer', quantity: 1 },
          ],
        },
      ],
    ])
  })

  it('rejects when Paddle fails, so the screen shows no amount instead of a wrong one', async () => {
    const { sdk } = fakePaddle()
    sdk.PricePreview = () => Promise.reject(new Error('preview failed'))
    await expect(
      previewPaddlePrices({ ...preview, loadSdk: () => Promise.resolve(sdk) }),
    ).rejects.toThrow('preview failed')
  })
})
