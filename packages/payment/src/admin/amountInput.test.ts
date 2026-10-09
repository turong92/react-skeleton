import { describe, expect, it } from 'vitest'
import { fractionDigits, minorToInput, parseAmountInput } from './amountInput'

describe('fractionDigits — how many decimals the currency has (Intl knows)', () => {
  it('KRW 0, USD 2, and an unknown code falls back to 0 instead of throwing', () => {
    expect(fractionDigits('KRW')).toBe(0)
    expect(fractionDigits('USD')).toBe(2)
    expect(fractionDigits('???')).toBe(0)
  })
})

describe('minorToInput — the amount as a person would type it', () => {
  it('writes whole units for 0 decimals and keeps the decimals otherwise', () => {
    expect(minorToInput(3000, 0)).toBe('3000')
    expect(minorToInput(2999, 2)).toBe('29.99')
    expect(minorToInput(3000, 2)).toBe('30.00')
    expect(minorToInput(5, 2)).toBe('0.05')
  })
})

describe('parseAmountInput — typed text to the smallest unit', () => {
  it('reads whole numbers, with thousands commas and spaces around', () => {
    expect(parseAmountInput('3000', 0)).toEqual({ kind: 'ok', minor: 3000 })
    expect(parseAmountInput(' 3,000 ', 0)).toEqual({ kind: 'ok', minor: 3000 })
  })

  it('reads decimals up to the currency digits, as exact integers (29.99 is 2999, not 2998.99999)', () => {
    expect(parseAmountInput('29.99', 2)).toEqual({ kind: 'ok', minor: 2999 })
    expect(parseAmountInput('30', 2)).toEqual({ kind: 'ok', minor: 3000 })
    expect(parseAmountInput('0.1', 2)).toEqual({ kind: 'ok', minor: 10 })
  })

  it('empty text is empty; anything that is not a plain non-negative number is invalid', () => {
    expect(parseAmountInput('', 0)).toEqual({ kind: 'empty' })
    expect(parseAmountInput('   ', 0)).toEqual({ kind: 'empty' })
    for (const bad of ['abc', '-5', '+5', '1e3', '1.5', '29.999', '1,0,0.', '.', '０', '3000원'])
      expect(parseAmountInput(bad, bad === '29.999' ? 2 : 0), bad).toEqual({ kind: 'invalid' })
  })

  it('zero is a number (the dialog says it must be above zero); a number too big to be exact is invalid', () => {
    expect(parseAmountInput('0', 0)).toEqual({ kind: 'ok', minor: 0 })
    expect(parseAmountInput('99999999999999999999', 0)).toEqual({ kind: 'invalid' })
  })
})
