import { describe, expect, it } from 'vitest'
import { EMPTY_ADD_PRICE_FORM, validateAddPrice, type AddPriceForm } from './addPriceForm'

const form = (over: Partial<AddPriceForm> = {}): AddPriceForm => ({
  ...EMPTY_ADD_PRICE_FORM,
  amount: '6900',
  ...over,
})

describe('validateAddPrice', () => {
  it('a plain monthly won price becomes minor units with the period and no sale fields', () => {
    expect(validateAddPrice(form(), 'SUBSCRIPTION')).toEqual({
      problems: null,
      input: { period: 'P1M', amount: 6900, currency: 'KRW' },
    })
  })

  it('dollars are typed as dollars and sent as cents, without float drift', () => {
    const result = validateAddPrice(
      form({ currency: 'USD', amount: '19.99', period: 'P1Y' }),
      'SUBSCRIPTION',
    )
    expect(result.input).toEqual({ period: 'P1Y', amount: 1999, currency: 'USD' })
    expect(
      validateAddPrice(form({ currency: 'USD', amount: '0.29' }), 'SUBSCRIPTION').input?.amount,
    ).toBe(29)
  })

  it('a one-time product sends no period, even if the form still holds one', () => {
    expect(validateAddPrice(form({ period: 'P1Y' }), 'ONE_TIME').input).toEqual({
      amount: 6900,
      currency: 'KRW',
    })
  })

  it('a custom period and a custom currency are read as typed (currency in capitals)', () => {
    const result = validateAddPrice(
      form({
        period: 'custom',
        customPeriod: ' P3M ',
        currency: 'custom',
        customCurrency: 'jpy',
        amount: '1000',
      }),
      'SUBSCRIPTION',
    )
    expect(result.input).toEqual({ period: 'P3M', amount: 1000, currency: 'JPY' })
  })

  it('an optional price code is sent trimmed, and left out when empty', () => {
    expect(validateAddPrice(form({ code: ' std-y ' }), 'SUBSCRIPTION').input?.code).toBe('std-y')
    expect(validateAddPrice(form({ code: '  ' }), 'SUBSCRIPTION').input).not.toHaveProperty('code')
  })

  it('names what is wrong with the amount, the period and the currency', () => {
    expect(validateAddPrice(form({ amount: '' }), 'SUBSCRIPTION').problems).toEqual({
      amount: 'amountEmpty',
    })
    expect(validateAddPrice(form({ amount: '12abc' }), 'SUBSCRIPTION').problems).toEqual({
      amount: 'amountInvalid',
    })
    expect(validateAddPrice(form({ amount: '0' }), 'SUBSCRIPTION').problems).toEqual({
      amount: 'amountZero',
    })
    // 원은 소수가 없다
    expect(validateAddPrice(form({ amount: '99.5' }), 'SUBSCRIPTION').problems).toEqual({
      amount: 'amountInvalid',
    })
    expect(
      validateAddPrice(form({ period: 'custom', customPeriod: 'monthly' }), 'SUBSCRIPTION')
        .problems,
    ).toEqual({ period: 'periodInvalid' })
    expect(
      validateAddPrice(form({ period: 'custom', customPeriod: 'P' }), 'SUBSCRIPTION').problems,
    ).toEqual({ period: 'periodInvalid' })
    expect(
      validateAddPrice(form({ currency: 'custom', customCurrency: 'US' }), 'SUBSCRIPTION').problems,
    ).toMatchObject({ currency: 'currencyInvalid' })
  })

  describe('sale price', () => {
    const sale = (over: Partial<AddPriceForm> = {}) =>
      form({ amount: '59000', period: 'P1Y', sale: true, regularAmount: '69000', ...over })

    it('turning the sale on sends the regular price; start and end are instants', () => {
      const result = validateAddPrice(
        sale({ saleStartsAt: '2026-11-01T09:00', saleEndsAt: '2026-11-02T09:00' }),
        'SUBSCRIPTION',
      )
      expect(result.input).toMatchObject({ amount: 59000, compareAtAmount: 69000 })
      expect(result.input?.saleStartsAt).toBe(new Date('2026-11-01T09:00').toISOString())
      expect(result.input?.saleEndsAt).toBe(new Date('2026-11-02T09:00').toISOString())
    })

    it('start and end are optional (now / no end)', () => {
      const result = validateAddPrice(sale(), 'SUBSCRIPTION')
      expect(result.input).not.toHaveProperty('saleStartsAt')
      expect(result.input).not.toHaveProperty('saleEndsAt')
    })

    it('the regular price must be above the sale price - equal is not enough', () => {
      expect(validateAddPrice(sale({ regularAmount: '59000' }), 'SUBSCRIPTION').problems).toEqual({
        regularAmount: 'regularNotAbove',
      })
      expect(validateAddPrice(sale({ regularAmount: '' }), 'SUBSCRIPTION').problems).toEqual({
        regularAmount: 'regularEmpty',
      })
    })

    it('the end must be after the start', () => {
      expect(
        validateAddPrice(
          sale({ saleStartsAt: '2026-11-02T09:00', saleEndsAt: '2026-11-01T09:00' }),
          'SUBSCRIPTION',
        ).problems,
      ).toEqual({ saleEndsAt: 'endBeforeStart' })
    })

    it('the sale fields are ignored while the sale is off', () => {
      const result = validateAddPrice(
        sale({ sale: false, regularAmount: 'nonsense' }),
        'SUBSCRIPTION',
      )
      expect(result.input).toEqual({ period: 'P1Y', amount: 59000, currency: 'KRW' })
    })
  })
})
