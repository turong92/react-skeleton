import { describe, expect, it } from 'vitest'
import { deltaOf, formatPointLabel, formatValue } from './format'
import type { DashboardMetric } from './types'

const base: DashboardMetric = {
  key: 'k',
  label: 'K',
  unit: 'COUNT',
  source: 'db',
  status: 'OK',
  freshness: null,
  value: [{ amount: 120, currency: null }],
  previousValue: [{ amount: 100, currency: null }],
  series: null,
  previousSeries: null,
  link: null,
}

describe('deltaOf', () => {
  it('is nothing when the comparison is off', () => {
    expect(deltaOf(base, false)).toEqual({ kind: 'off' })
  })

  it('is a percent with a direction, one decimal', () => {
    expect(deltaOf(base, true)).toEqual({ kind: 'up', percent: 20 })
    expect(
      deltaOf(
        {
          ...base,
          value: [{ amount: 87, currency: null }],
          previousValue: [{ amount: 91, currency: null }],
        },
        true,
      ),
    ).toEqual({
      kind: 'down',
      percent: 4.4,
    })
  })

  it('says unavailable when the server gave no previous value (active users) or the value is missing', () => {
    expect(deltaOf({ ...base, previousValue: null }, true)).toEqual({ kind: 'unavailable' })
    expect(deltaOf({ ...base, status: 'NOT_CONNECTED', value: null }, true)).toEqual({
      kind: 'unavailable',
    })
  })

  it('has no percent from a zero base', () => {
    expect(deltaOf({ ...base, previousValue: [{ amount: 0, currency: null }] }, true)).toEqual({
      kind: 'new',
    })
    expect(
      deltaOf(
        {
          ...base,
          value: [{ amount: 0, currency: null }],
          previousValue: [{ amount: 0, currency: null }],
        },
        true,
      ),
    ).toEqual({
      kind: 'flat',
      percent: 0,
    })
  })

  it('gives no delta when the previous period has no value in the same currency (never compares KRW with USD)', () => {
    const money: DashboardMetric = {
      ...base,
      unit: 'MONEY',
      value: [{ amount: 200, currency: 'KRW' }],
      previousValue: [{ amount: 100, currency: 'USD' }],
    }
    expect(deltaOf(money, true)).toEqual({ kind: 'unavailable' })
  })

  it('compares money in the same currency, not the first one it finds', () => {
    const money: DashboardMetric = {
      ...base,
      unit: 'MONEY',
      value: [{ amount: 200, currency: 'USD' }],
      previousValue: [
        { amount: 1000, currency: 'KRW' },
        { amount: 100, currency: 'USD' },
      ],
    }
    expect(deltaOf(money, true)).toEqual({ kind: 'up', percent: 100 })
  })
})

describe('formatValue', () => {
  it('writes money in the currency minor units (KRW 0 digits, USD 2)', () => {
    expect(formatValue({ amount: 4_610_000, currency: 'KRW' }, 'MONEY', { locale: 'en-US' })).toBe(
      '₩4,610,000',
    )
    expect(formatValue({ amount: 99_000, currency: 'USD' }, 'MONEY', { locale: 'en-US' })).toBe(
      '$990.00',
    )
    expect(
      formatValue({ amount: 4_610_000, currency: 'KRW' }, 'MONEY', {
        locale: 'ko-KR',
        currencySuffix: { KRW: '원' },
      }),
    ).toBe('4,610,000원')
  })

  it('writes a percent from basis points (the contract does not fix the scale; see format.ts)', () => {
    expect(formatValue({ amount: 3820, currency: null }, 'PERCENT', { locale: 'en-US' })).toBe(
      '38.2%',
    )
  })
})

describe('formatPointLabel', () => {
  it('writes the time in the dashboard zone: hours for HOUR, month/day for DAY, with a tilde for WEEK', () => {
    expect(formatPointLabel('2026-10-25T15:00:00Z', 'HOUR', 'Asia/Seoul', 'en-US')).toBe('00:00')
    expect(formatPointLabel('2026-10-25T15:00:00Z', 'DAY', 'Asia/Seoul', 'en-US')).toBe('10/26')
    expect(formatPointLabel('2026-10-25T15:00:00Z', 'WEEK', 'Asia/Seoul', 'en-US')).toBe('10/26~')
  })
})
