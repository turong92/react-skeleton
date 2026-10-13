import { describe, expect, it } from 'vitest'
import { initialLocale } from './initialLocale'

describe('initialLocale (nobody has chosen a language yet)', () => {
  it('the dev country decides first: KR is Korean, any other is English', () => {
    expect(initialLocale({ devCountry: 'KR', languages: ['en-US'] })).toBe('ko')
    expect(initialLocale({ devCountry: 'US', languages: ['ko-KR'] })).toBe('en')
  })

  it('without a country the first supported browser language wins, and a browser that speaks neither gets English', () => {
    expect(initialLocale({ devCountry: null, languages: ['ja', 'ko-KR', 'en'] })).toBe('ko')
    expect(initialLocale({ devCountry: null, languages: ['en-GB'] })).toBe('en')
    expect(initialLocale({ devCountry: null, languages: ['ja', 'fr'] })).toBe('en')
    expect(initialLocale({ devCountry: null, languages: [] })).toBe('en')
  })
})
