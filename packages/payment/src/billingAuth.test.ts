import { describe, expect, it } from 'vitest'
import { openBillingAuth } from './billingAuth'
import type { TossPaymentsFactory } from './checkout'
import type { BillingAuth } from './subscriptionTypes'
import { PaymentRedirectError } from './tossRedirect'
import { readBillingReturn } from './billingReturn'

const billingAuth: BillingAuth = {
  provider: 'toss',
  kind: 'TOSS_BILLING_AUTH',
  testMode: true,
  clientKey: 'test_ck_abc',
  customerKey: 'cus_0123',
  attributes: {},
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
            requestBillingAuth: async (request: unknown) => {
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

describe('openBillingAuth — TOSS_BILLING_AUTH', () => {
  it('opens the card registration window with the server customerKey and nothing else', async () => {
    const { factory, seen } = fakeSdk()
    await openBillingAuth(billingAuth, {
      successUrl: 'https://app.example/subscriptions/return',
      failUrl: 'https://app.example/subscriptions/return?x=1',
      loadSdk: async () => factory,
    })
    expect(seen.clientKey).toBe('test_ck_abc')
    expect(seen.paymentOptions).toEqual({ customerKey: 'cus_0123' })
    expect(seen.request).toEqual({
      method: 'CARD',
      successUrl: 'https://app.example/subscriptions/return',
      failUrl: 'https://app.example/subscriptions/return?x=1',
    })
  })

  it('stops before loading the script when the server gave no client key', async () => {
    let loaded = false
    await expect(
      openBillingAuth(
        { ...billingAuth, clientKey: null },
        {
          successUrl: 's',
          failUrl: 'f',
          loadSdk: async () => {
            loaded = true
            return fakeSdk().factory
          },
        },
      ),
    ).rejects.toThrow(/client key/)
    expect(loaded).toBe(false)
  })

  it('throws on a kind it does not know', async () => {
    await expect(
      openBillingAuth({ ...billingAuth, kind: 'STRIPE_SETUP' } as unknown as BillingAuth, {
        successUrl: 's',
        failUrl: 'f',
        loadSdk: async () => fakeSdk().factory,
      }),
    ).rejects.toThrow(/Unknown billing auth kind: STRIPE_SETUP/)
  })
})

describe('readBillingReturn (what the card window put on successUrl / failUrl)', () => {
  it('success: authKey + customerKey', () => {
    expect(readBillingReturn('?authKey=bk_1&customerKey=cus_0123')).toEqual({
      ok: true,
      authKey: 'bk_1',
    })
  })

  it('accepts URLSearchParams as well as a string', () => {
    expect(readBillingReturn(new URLSearchParams({ authKey: 'bk_2' }))).toEqual({
      ok: true,
      authKey: 'bk_2',
    })
  })

  it('failure: only the code comes back, never the provider message', () => {
    const result = readBillingReturn('?code=USER_CANCEL&message=%EB%8B%AB%EC%9D%8C')
    expect(result).toEqual({ ok: false, code: 'USER_CANCEL' })
    expect(Object.keys(result)).not.toContain('message')
  })

  it('an empty or unrelated address is a PaymentRedirectError', () => {
    expect(() => readBillingReturn('')).toThrow(PaymentRedirectError)
    expect(() => readBillingReturn('?customerKey=cus_1')).toThrow(PaymentRedirectError)
    expect(() => readBillingReturn('?authKey=')).toThrow(PaymentRedirectError)
  })
})
