import { describe, expect, it } from 'vitest'
import { detectLocale } from './detectLocale'

const supported = ['ko', 'en', 'pt-BR'] as const

describe('detectLocale', () => {
  it('prefers the stored choice over the browser languages', () => {
    expect(
      detectLocale({ supported, defaultLocale: 'ko', stored: 'en', languages: ['ko-KR'] }),
    ).toBe('en')
  })

  it('ignores a stored value that is not supported (an old choice after a locale was removed)', () => {
    expect(
      detectLocale({ supported, defaultLocale: 'ko', stored: 'fr', languages: ['en-US'] }),
    ).toBe('en')
  })

  it('takes the first browser language whose primary tag is supported', () => {
    expect(
      detectLocale({
        supported,
        defaultLocale: 'ko',
        stored: null,
        languages: ['fr-FR', 'en-GB', 'ko'],
      }),
    ).toBe('en')
  })

  it('matches a full regional tag before the primary tag, case-insensitively', () => {
    expect(
      detectLocale({ supported, defaultLocale: 'ko', stored: null, languages: ['pt-br'] }),
    ).toBe('pt-BR')
  })

  it('falls back to the default locale when nothing matches or there are no languages (server)', () => {
    expect(
      detectLocale({ supported, defaultLocale: 'ko', stored: null, languages: ['fr', 'de'] }),
    ).toBe('ko')
    expect(detectLocale({ supported, defaultLocale: 'en', stored: null, languages: [] })).toBe('en')
  })

  it('understands underscore tags (ko_KR)', () => {
    expect(
      detectLocale({ supported, defaultLocale: 'en', stored: null, languages: ['ko_KR'] }),
    ).toBe('ko')
  })
})
