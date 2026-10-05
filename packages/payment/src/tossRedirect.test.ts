import { describe, expect, it } from 'vitest'
import { confirmRequestFromTossRedirect, PaymentRedirectError } from './tossRedirect'

/* 토스 successUrl 이 붙여 주는 paymentKey · orderId · amount 를 백엔드 TossPaymentProvider.confirmBody 의 입력으로 */
describe('confirmRequestFromTossRedirect', () => {
  it('maps paymentKey / orderId / amount onto a PaymentConfirmRequest for the toss provider', () => {
    expect(
      confirmRequestFromTossRedirect('?paymentKey=pk_1&orderId=order-9&amount=15000', {
        currency: 'KRW',
      }),
    ).toEqual({
      providerPaymentId: 'pk_1',
      merchantReferenceId: 'order-9',
      amount: { amount: 15000, currency: 'KRW' },
      provider: 'toss',
    })
  })

  it('the provider id is configurable (skeleton.payment.providers / the toss providerId)', () => {
    const request = confirmRequestFromTossRedirect(
      new URLSearchParams('paymentKey=a&orderId=b&amount=1'),
      {
        currency: 'KRW',
        provider: 'toss-kr',
      },
    )
    expect(request.provider).toBe('toss-kr')
  })

  it('a missing paymentKey, orderId or amount is a PaymentRedirectError naming it', () => {
    for (const missing of ['paymentKey', 'orderId', 'amount']) {
      const params = new URLSearchParams({ paymentKey: 'a', orderId: 'b', amount: '1' })
      params.delete(missing)
      const failure = (() => {
        try {
          confirmRequestFromTossRedirect(params, { currency: 'KRW' })
        } catch (error) {
          return error
        }
      })()
      expect(failure).toBeInstanceOf(PaymentRedirectError)
      expect((failure as Error).message).toContain(missing)
    }
  })

  it('an amount that is not a whole non-negative number is rejected (the backend amount is a Long ≥ 0)', () => {
    for (const bad of ['abc', '-5', '1.5', '']) {
      expect(() =>
        confirmRequestFromTossRedirect(`?paymentKey=a&orderId=b&amount=${bad}`, {
          currency: 'KRW',
        }),
      ).toThrow(PaymentRedirectError)
    }
  })
})
