import { describe, expect, it } from 'vitest'
import {
  adminMethodDisplay,
  cardDisplay,
  formatMoney,
  lookup,
  priceEveryDisplay,
  requestedAmountNote,
} from './format'
import { defaultPaymentLabels, koPaymentLabels, resolvePaymentLabels } from './labels'

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

  it('names the app of an easy pay the provider took directly - and says 간편결제 for any other', () => {
    const brand = (easyPayBrand: string | null | undefined) =>
      cardDisplay({ method: 'EASY_PAY', card: null, easyPayBrand }, labels)
    expect(brand('KAKAOPAY')).toBe('카카오페이')
    expect(brand('NAVERPAY')).toBe('네이버페이')
    expect(brand('NO_SUCH_APP')).toBe('간편결제')
    expect(brand(null)).toBe('간편결제')
    expect(brand(undefined)).toBe('간편결제') // 구버전 서버
    expect(cardDisplay({ method: 'CARD', card: null, easyPayBrand: 'KAKAOPAY' }, labels)).toBe(
      '카드',
    )
  })

  it('an easy pay paid with a card names the app and then the card', () => {
    expect(
      cardDisplay(
        {
          method: 'EASY_PAY',
          card: { issuer: 'SHINHAN', last4: '374*' },
          easyPayBrand: 'KAKAOPAY',
        },
        labels,
      ),
    ).toBe('카카오페이 · 신한카드 ····374*')
    expect(cardDisplay({ method: 'EASY_PAY', card: null, easyPayBrand: 'TOSSPAY' }, labels)).toBe(
      '토스페이',
    )
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

describe('requestedAmountNote', () => {
  const labels = resolvePaymentLabels(koPaymentLabels)
  const won = (amount: number) => ({ amount, currency: 'KRW' })

  it('says what was first asked only when the operator refunded a different amount', () => {
    expect(requestedAmountNote({ amount: won(3000), requestedAmount: won(5000) }, labels)).toBe(
      '요청 5,000원',
    )
    expect(
      requestedAmountNote({ amount: won(5000), requestedAmount: won(5000) }, labels),
    ).toBeNull()
    expect(requestedAmountNote({ amount: won(5000), requestedAmount: null }, labels)).toBeNull()
    expect(requestedAmountNote({ amount: won(5000) }, labels)).toBeNull()
  })
})

describe('adminMethodDisplay — the app and the route, so Toss, Kakao and Naver side by side are not confused', () => {
  const show = (provider: string, easyPayBrand: string | null, method = 'EASY_PAY') =>
    adminMethodDisplay({ method, card: null, easyPayBrand, provider }, koPaymentLabels)

  it('says which provider the money goes through', () => {
    expect(show('kakaopay', 'KAKAOPAY')).toBe('카카오페이 · 직접')
    expect(show('naverpay', 'NAVERPAY')).toBe('네이버페이 · 직접')
    expect(show('toss', 'KAKAOPAY')).toBe('카카오페이 · 토스 경유')
    expect(show('toss', null)).toBe('간편결제 · 토스 경유')
  })

  it('a card payment keeps just the card; an unknown provider id is shown as it is', () => {
    expect(
      adminMethodDisplay(
        {
          method: 'CARD',
          card: { issuer: 'HYUNDAI', last4: '1234' },
          easyPayBrand: null,
          provider: 'toss',
        },
        koPaymentLabels,
      ),
    ).toBe('현대카드 ····1234')
    expect(show('someother', 'KAKAOPAY')).toBe('카카오페이 · someother')
  })
})
