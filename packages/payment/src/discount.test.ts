import { describe, expect, it } from 'vitest'
import { discountLines, discountErrorMessage, settlementLabel, settlementOf } from './discount'
import { defaultPaymentLabels, koPaymentLabels } from './labels'
import { ApiRequestError } from '@skeleton/api-client'
import { order } from './test/fixtures'

const ko = (o: Parameters<typeof discountLines>[0]) =>
  discountLines(o, koPaymentLabels, { locale: 'ko-KR' })

describe('settlementOf', () => {
  it('reads the server field, and falls back on the reserved provider ids for older responses', () => {
    expect(settlementOf(order({ settlement: 'FREE' }))).toBe('FREE')
    expect(settlementOf({ ...order(), provider: 'exempt' })).toBe('EXEMPT')
    expect(settlementOf({ ...order(), provider: 'free' })).toBe('FREE')
    expect(settlementOf({ ...order(), provider: 'toss' })).toBe('PROVIDER')
    expect(settlementOf(order())).toBe('PROVIDER')
  })
})

describe('discountLines', () => {
  it('lists original, each discount (negative) and the final price', () => {
    const lines = ko(
      order({
        amount: { amount: 8400, currency: 'KRW' },
        originalAmount: 12000,
        discountAmount: 3600,
        discounts: [{ type: 'coupon', ref: 'c1', label: '가입 환영 쿠폰', amount: 3600 }],
      }),
    )
    expect(lines.map((l) => [l.kind, l.label, l.value])).toEqual([
      ['original', '상품 금액', '12,000원'],
      ['discount', '가입 환영 쿠폰', '-3,600원'],
      ['final', '결제 금액', '8,400원'],
    ])
  })

  it('has no lines without a discount', () => {
    expect(ko(order())).toEqual([])
    expect(ko(order({ originalAmount: 3000, discountAmount: 0, discounts: [] }))).toEqual([])
  })

  it('an exempt order is not a discount: no discount lines, only the 결제 면제 label', () => {
    const exempt = order({
      settlement: 'EXEMPT',
      originalAmount: 12000,
      discountAmount: 0,
      amount: { amount: 0, currency: 'KRW' },
    })
    expect(ko(exempt)).toEqual([])
    expect(settlementLabel('EXEMPT', koPaymentLabels)).toBe('결제 면제')
    expect(settlementLabel('FREE', koPaymentLabels)).toBe('무료(쿠폰)')
    expect(settlementLabel('PROVIDER', koPaymentLabels)).toBeNull()
    expect(settlementLabel('EXEMPT', defaultPaymentLabels)).toBe('Payment waived')
  })
})

describe('discountErrorMessage', () => {
  const err = (code: string, status: number) =>
    new ApiRequestError({ code, title: 't', status, timestamp: 't' } as never, 't', 's', 'p')
  it.each([
    ['PAYMENT.DISCOUNT_NOT_APPLICABLE', 400, koPaymentLabels.discount.errors.notApplicable],
    ['PAYMENT.DISCOUNT_UNAVAILABLE', 409, koPaymentLabels.discount.errors.unavailable],
    ['PAYMENT.DISCOUNT_NOT_SUPPORTED', 400, koPaymentLabels.discount.errors.notSupported],
    ['PAYMENT.DISCOUNT_BELOW_MINIMUM', 400, koPaymentLabels.discount.errors.belowMinimum],
    ['PAYMENT.NOTHING_TO_REFUND', 409, koPaymentLabels.discount.errors.nothingToRefund],
  ])('%s → its sentence', (code, status, text) => {
    expect(discountErrorMessage(err(code, status), koPaymentLabels)).toBe(text)
  })
  it('anything else is null (the caller keeps its own message)', () => {
    expect(discountErrorMessage(err('PAYMENT.DECLINED', 402), koPaymentLabels)).toBeNull()
    expect(discountErrorMessage(new Error('x'), koPaymentLabels)).toBeNull()
  })
})
