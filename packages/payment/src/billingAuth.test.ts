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

describe('openBillingAuth — KakaoPay / NaverPay (the browser is sent to the address the server reserved)', () => {
  const kakao: BillingAuth = {
    provider: 'kakaopay',
    kind: 'KAKAOPAY_BILLING_REDIRECT',
    testMode: true,
    clientKey: null,
    customerKey: 'cus_0123',
    attributes: { pcUrl: 'https://pc.example/pay/T1', mobileUrl: 'https://m.example/pay/T1' },
  }
  const naver: BillingAuth = {
    provider: 'naverpay',
    kind: 'NAVERPAY_BILLING_REDIRECT',
    testMode: true,
    clientKey: null,
    customerKey: 'cus_0123',
    attributes: { windowUrl: 'https://pay.example/payments/recurrent/RGR1' },
  }
  const urls = { successUrl: 's', failUrl: 'f' }

  it('KakaoPay goes to the PC address on a desktop and the mobile address on a phone, without any SDK', async () => {
    const seen: string[] = []
    await openBillingAuth(kakao, {
      ...urls,
      navigate: (url) => seen.push(url),
      isMobile: () => false,
    })
    await openBillingAuth(kakao, {
      ...urls,
      navigate: (url) => seen.push(url),
      isMobile: () => true,
    })
    expect(seen).toEqual(['https://pc.example/pay/T1', 'https://m.example/pay/T1'])
  })

  it('NaverPay goes to the registration window address', async () => {
    const seen: string[] = []
    await openBillingAuth(naver, { ...urls, navigate: (url) => seen.push(url) })
    expect(seen).toEqual(['https://pay.example/payments/recurrent/RGR1'])
  })

  it('an address that is not http(s) is never followed, and a missing one stops too', async () => {
    const seen: string[] = []
    const navigate = (url: string) => seen.push(url)
    await expect(
      openBillingAuth(
        { ...kakao, attributes: { pcUrl: 'javascript:alert(1)', mobileUrl: 'data:text/html,x' } },
        { ...urls, navigate },
      ),
    ).rejects.toThrow(/http\(s\) address/)
    await expect(
      openBillingAuth({ ...naver, attributes: {} }, { ...urls, navigate }),
    ).rejects.toThrow(/http\(s\) address/)
    expect(seen).toEqual([])
  })
})

describe('readBillingReturn — KakaoPay / NaverPay', () => {
  it('KakaoPay success carries the pg_token as the activation payload, and nothing from the address beyond it', () => {
    expect(
      readBillingReturn(
        '?kind=KAKAOPAY_BILLING_REDIRECT&provider=kakaopay&sub=sub_1&result=success&pg_token=pgt_1',
      ),
    ).toEqual({ ok: true, providerPayload: { pg_token: 'pgt_1' } })
  })

  it('KakaoPay cancel and fail read as the buyer closing it or a failure; success without a token is an error', () => {
    const base = '?kind=KAKAOPAY_BILLING_REDIRECT&provider=kakaopay&sub=sub_1'
    expect(readBillingReturn(`${base}&result=cancel`)).toEqual({ ok: false, code: 'CANCELED' })
    expect(readBillingReturn(`${base}&result=fail`)).toEqual({ ok: false, code: 'FAILED' })
    expect(() => readBillingReturn(`${base}&result=success`)).toThrow(PaymentRedirectError)
    expect(() => readBillingReturn(`${base}&result=unknown`)).toThrow(PaymentRedirectError)
  })

  it('NaverPay success carries reserveId and tempReceiptId; a user cancel is CANCELED, any other result code FAILED, and the provider message is never read', () => {
    const base = '?kind=NAVERPAY_BILLING_REDIRECT&provider=naverpay&sub=sub_1'
    expect(
      readBillingReturn(`${base}&resultCode=Success&reserveId=RGR1&tempReceiptId=TR1`),
    ).toEqual({
      ok: true,
      providerPayload: { reserveId: 'RGR1', tempReceiptId: 'TR1' },
    })
    expect(readBillingReturn(`${base}&resultCode=UserCancel`)).toEqual({
      ok: false,
      code: 'CANCELED',
    })
    const failed = readBillingReturn(
      `${base}&resultCode=Fail&resultMessage=%EB%AC%B8%EC%9E%90&reserveId=RGR1`,
    )
    expect(failed).toEqual({ ok: false, code: 'FAILED' })
    expect(() => readBillingReturn(`${base}&resultCode=Success&reserveId=RGR1`)).toThrow(
      PaymentRedirectError,
    )
    expect(() => readBillingReturn(base)).toThrow(PaymentRedirectError)
  })
})
