import { describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { seoDefaultsOf, seoMetaOf } from './routeSeo'

const t = (key: Parameters<typeof i18n.t>[0]) => i18n.tIn('ko', key)

describe('seoMetaOf', () => {
  it('a public page: its own title and description, canonical = its path, no robots', () => {
    const meta = seoMetaOf(
      { titleKey: 'seo.terms.title', descriptionKey: 'seo.terms.description', indexable: true },
      { t, pathname: '/terms' },
    )
    expect(meta).toMatchObject({
      title: t('seo.terms.title'),
      description: t('seo.terms.description'),
      canonical: '/terms',
    })
    expect(meta.robots).toBeUndefined()
  })

  it('a page behind the login is noindex, nofollow and has no canonical', () => {
    const meta = seoMetaOf(
      { titleKey: 'nav.notes', descriptionKey: 'seo.app.description', indexable: false },
      { t, pathname: '/notes' },
    )
    expect(meta.robots).toBe('noindex, nofollow')
    expect(meta.canonical).toBeUndefined()
  })

  it('structured data is built from the same translator (the FAQ answers the visitor reads are the ones the crawler gets)', () => {
    const meta = seoMetaOf(
      {
        titleKey: 'seo.landing.title',
        descriptionKey: 'seo.landing.description',
        indexable: true,
        jsonLd: (translate) => [{ '@type': 'Thing', name: translate('appName') }],
      },
      { t, pathname: '/' },
    )
    expect(meta.jsonLd).toEqual([{ '@type': 'Thing', name: 'Notes' }])
  })
})

describe('seoDefaultsOf', () => {
  it('site name = app name, "<page> · <app>" titles, locale in og form, baseUrl from the app env', () => {
    expect(
      seoDefaultsOf({ siteName: 'Notes', locale: 'ko', siteUrl: 'https://notes.example.com' }),
    ).toEqual({
      siteName: 'Notes',
      titleTemplate: '%s · Notes',
      baseUrl: 'https://notes.example.com',
      locale: 'ko_KR',
    })
    expect(seoDefaultsOf({ siteName: 'Notes', locale: 'en', siteUrl: undefined }).locale).toBe(
      'en_US',
    )
  })
})
