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

  it('the replaced price code is sent when one is chosen, and left out when none', () => {
    expect(validateAddPrice(form({ replaces: 'std-m' }), 'SUBSCRIPTION').input?.replaces).toBe(
      'std-m',
    )
    expect(validateAddPrice(form(), 'SUBSCRIPTION').input).not.toHaveProperty('replaces')
  })

  it('a price code uses the backend shape: underscores allowed, up to 64 characters', () => {
    expect(validateAddPrice(form({ code: 'std_y-1' }), 'SUBSCRIPTION').input?.code).toBe('std_y-1')
    expect(validateAddPrice(form({ code: 'Bad Code' }), 'SUBSCRIPTION').problems).toEqual({
      code: 'codeInvalid',
    })
    expect(validateAddPrice(form({ code: 'a'.repeat(65) }), 'SUBSCRIPTION').problems).toEqual({
      code: 'codeInvalid',
    })
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

    it('an empty start becomes now (a sale with neither would be read as a regular price); an empty end is no end', () => {
      const now = new Date('2026-11-01T00:00:00Z')
      const result = validateAddPrice(sale(), 'SUBSCRIPTION', now)
      expect(result.input?.saleStartsAt).toBe('2026-11-01T00:00:00.000Z')
      expect(result.input).not.toHaveProperty('saleEndsAt')
    })

    it('an end already past the filled-in start is refused', () => {
      const now = new Date('2026-11-01T00:00:00Z')
      expect(
        validateAddPrice(sale({ saleEndsAt: '2020-01-01T09:00' }), 'SUBSCRIPTION', now).problems,
      ).toEqual({ saleEndsAt: 'endBeforeStart' })
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
