import { describe, expect, it } from 'vitest'
import { cardDisplay, formatMoney, lookup, priceEveryDisplay } from './format'
import { defaultPaymentLabels, koPaymentLabels } from './labels'

describe('formatMoney', () => {
  it('writes won the way people read it, using the suffix from the labels', () => {
    expect(
      formatMoney(
        { amount: 3000, currency: 'KRW' },
        { locale: 'ko-KR', currencySuffix: koPaymentLabels.currencySuffix },
      ),
    ).toBe('3,000원')
  })

  it('falls back to Intl currency formatting and treats the amount as minor units', () => {
    expect(formatMoney({ amount: 1250, currency: 'USD' }, { locale: 'en-US' })).toBe('$12.50')
    expect(formatMoney({ amount: 3000, currency: 'KRW' }, { locale: 'en-US' })).toBe('₩3,000')
  })
})

describe('cardDisplay', () => {
  const labels = koPaymentLabels
  const show = (
    method: string | null,
    card: { issuer: string | null; last4: string | null } | null,
  ) => cardDisplay({ method, card }, labels)

  it('shows issuer name and the last four digits as they came', () => {
    expect(show('CARD', { issuer: 'HYUNDAI', last4: '1234' })).toBe('현대카드 ····1234')
    expect(show('CARD', { issuer: 'HYUNDAI', last4: '12**' })).toBe('현대카드 ····12**')
  })

  it('says just 카드 for an issuer code the labels do not know', () => {
    expect(show('CARD', { issuer: 'NO_SUCH_BANK', last4: '1234' })).toBe('카드 ····1234')
    expect(show('CARD', { issuer: 'NO_SUCH_BANK', last4: null })).toBe('카드')
  })

  it('shows the name alone without last four, and the last four alone without an issuer', () => {
    expect(show('CARD', { issuer: 'HYUNDAI', last4: null })).toBe('현대카드')
    expect(show('CARD', { issuer: null, last4: '1234' })).toBe('카드 ····1234')
  })

  it('falls back to the kind of payment when there is no card (or both fields were erased)', () => {
    expect(show('EASY_PAY', null)).toBe('간편결제')
    expect(show('CARD', null)).toBe('카드')
    expect(show('CARD', { issuer: null, last4: null })).toBe('카드')
    expect(show('EASY_PAY', { issuer: null, last4: null })).toBe('간편결제')
  })

  it('shows nothing when not even the kind is known', () => {
    expect(show(null, null)).toBeNull()
    expect(show('SOMETHING_NEW', null)).toBeNull()
  })

  it('has English defaults for the same shapes', () => {
    expect(
      cardDisplay(
        { method: 'CARD', card: { issuer: 'HYUNDAI', last4: '1234' } },
        defaultPaymentLabels,
      ),
    ).toBe('Hyundai Card ····1234')
  })
})

describe('lookup — a text table is read by its own keys only', () => {
  it('finds own keys, and nothing for a code that is only a member of Object.prototype', () => {
    const table = { PAID: 'ok' }
    expect(lookup(table, 'PAID')).toBe('ok')
    for (const code of [
      'constructor',
      'toString',
      '__proto__',
      'hasOwnProperty',
      'NEW_ONE',
      '',
      null,
      undefined,
    ])
      expect(lookup(table, code), String(code)).toBeUndefined()
  })

  it('so cardDisplay never turns a prototype member into a card name or a method', () => {
    const labels = koPaymentLabels
    expect(
      cardDisplay({ method: 'CARD', card: { issuer: 'constructor', last4: '1234' } }, labels),
    ).toBe('카드 ····1234')
    expect(cardDisplay({ method: 'toString', card: null }, labels)).toBeNull()
  })
})

describe('priceEveryDisplay (ISO-8601 period → 「3,900원 · 1개월마다 결제」)', () => {
  const labels = koPaymentLabels
  const money = { amount: 3900, currency: 'KRW' }
  it('reads the first non-zero unit of the period', () => {
    expect(priceEveryDisplay(money, 'P1M', labels, 'ko-KR')).toBe('3,900원 · 1개월마다 결제')
    expect(priceEveryDisplay(money, 'P3M', labels, 'ko-KR')).toBe('3,900원 · 3개월마다 결제')
    expect(priceEveryDisplay(money, 'P1Y', labels, 'ko-KR')).toBe('3,900원 · 1년마다 결제')
    expect(priceEveryDisplay(money, 'P2W', labels, 'ko-KR')).toBe('3,900원 · 2주마다 결제')
    expect(priceEveryDisplay(money, 'PT3M', labels, 'ko-KR')).toBe('3,900원 · 3분마다 결제')
    expect(priceEveryDisplay(money, 'PT1H', labels, 'ko-KR')).toBe('3,900원 · 1시간마다 결제')
  })
  it('a period it cannot read shows the price alone, never the raw code', () => {
    expect(priceEveryDisplay(money, 'monthly', labels, 'ko-KR')).toBe('3,900원')
    expect(priceEveryDisplay(money, 'P0D', labels, 'ko-KR')).toBe('3,900원')
  })
})
