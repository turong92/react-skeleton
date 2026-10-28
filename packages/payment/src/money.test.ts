import { describe, expect, it } from 'vitest'
import { currencyDigits, toMajorUnits, toMinorUnits } from './money'

describe('money — minor units follow the currency', () => {
  it('KRW has no minor unit and USD has two', () => {
    expect(currencyDigits('KRW')).toBe(0)
    expect(currencyDigits('USD')).toBe(2)
  })

  it('USD cents become dollars and back without float drift', () => {
    expect(toMajorUnits(1999, 'USD')).toBe(19.99)
    expect(toMinorUnits(19.99, 'USD')).toBe(1999)
    expect(toMinorUnits(0.29, 'USD')).toBe(29)
  })

  it('won pass through unchanged', () => {
    expect(toMajorUnits(9900, 'KRW')).toBe(9900)
    expect(toMinorUnits(9900, 'KRW')).toBe(9900)
  })

  it('an unknown currency code falls back to two digits instead of throwing', () => {
    expect(currencyDigits('???')).toBe(2)
  })
})
