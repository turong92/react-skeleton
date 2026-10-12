import { describe, expect, it } from 'vitest'
import { countryForLocale, countryName, countryOptions } from './country'

describe('the buyer country', () => {
  it('is prefilled from the screen language - Korean reads Korea, English reads the United States, a region tag wins', () => {
    expect(countryForLocale('ko')).toBe('KR')
    expect(countryForLocale('en')).toBe('US')
    expect(countryForLocale('en-GB')).toBe('GB')
    expect(countryForLocale('ja')).toBe('JP')
  })

  it('falls back to Korea for a language it cannot place', () => {
    expect(countryForLocale('not a locale')).toBe('KR')
  })

  it('always offers the prefilled country, once, first', () => {
    expect(countryOptions('KR')[0]).toBe('KR')
    expect(countryOptions('KR').filter((code) => code === 'KR')).toHaveLength(1)
    expect(countryOptions('BR')).toContain('BR')
  })

  it('names a country in the screen language', () => {
    expect(countryName('KR', 'ko')).toBe('대한민국')
    expect(countryName('KR', 'en')).toBe('South Korea')
  })
})
