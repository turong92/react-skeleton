import { describe, expect, it } from 'vitest'
import { PaymentRedirectError } from './tossRedirect'
import { readCheckoutReturn } from './checkoutReturn'

describe('readCheckoutReturn (what the payment window put on successUrl / failUrl)', () => {
  it('success: paymentKey + orderId + amount → { ok: true, orderId, providerPaymentId, amount }', () => {
    expect(readCheckoutReturn('?paymentKey=pay_1&orderId=ord_1&amount=3000')).toEqual({
      ok: true,
      orderId: 'ord_1',
      providerPaymentId: 'pay_1',
      amount: 3000,
    })
  })

  it('accepts URLSearchParams as well as a string', () => {
    const params = new URLSearchParams({ paymentKey: 'p', orderId: 'o', amount: '10' })
    expect(readCheckoutReturn(params)).toMatchObject({ ok: true, amount: 10 })
  })

  it('failure: code + orderId → { ok: false, orderId, code } and never hands back the provider message', () => {
    const result = readCheckoutReturn(
      '?code=PAY_PROCESS_CANCELED&message=%EC%82%AC%EC%9A%A9%EC%9E%90%EA%B0%80+%EC%B7%A8%EC%86%8C&orderId=ord_1',
    )
    expect(result).toEqual({ ok: false, orderId: 'ord_1', code: 'PAY_PROCESS_CANCELED' })
    expect(Object.keys(result)).not.toContain('message')
  })

  it('failure without an orderId keeps orderId null (the caller cannot abandon, but can still show the result)', () => {
    expect(readCheckoutReturn('?code=PAY_PROCESS_ABORTED')).toEqual({
      ok: false,
      orderId: null,
      code: 'PAY_PROCESS_ABORTED',
    })
  })

  it('a paymentKey wins over a stray code (success is what the server then verifies)', () => {
    expect(readCheckoutReturn('?paymentKey=p&orderId=o&amount=5&code=X')).toMatchObject({
      ok: true,
    })
  })

  it('throws PaymentRedirectError when it is neither a success nor a failure', () => {
    expect(() => readCheckoutReturn('')).toThrow(PaymentRedirectError)
    expect(() => readCheckoutReturn('?foo=bar')).toThrow(PaymentRedirectError)
  })

  it('throws when a success is missing orderId or its amount is not a whole number', () => {
    expect(() => readCheckoutReturn('?paymentKey=p&amount=5')).toThrow(PaymentRedirectError)
    expect(() => readCheckoutReturn('?paymentKey=p&orderId=o')).toThrow(PaymentRedirectError)
    expect(() => readCheckoutReturn('?paymentKey=p&orderId=o&amount=12.5')).toThrow(
      PaymentRedirectError,
    )
    expect(() => readCheckoutReturn('?paymentKey=p&orderId=o&amount=-1')).toThrow(
      PaymentRedirectError,
    )
  })

  it('keeps the address values out of its error messages (fixed sentences only)', () => {
    let message = ''
    try {
      readCheckoutReturn('?paymentKey=p&orderId=o&amount=SECRET-12.5')
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).not.toContain('SECRET')
    expect(message).toMatch(/amount/)
  })
})
