import { describe, expect, it } from 'vitest'
import { breadcrumbLd, faqLd, organizationLd, serializeJsonLd, webSiteLd } from './jsonLd'

describe('serializeJsonLd', () => {
  it('round-trips and cannot break out of a script element', () => {
    const value = { a: '</script><!--', b: '\u2028\u2029', c: '&>' }
    const text = serializeJsonLd(value)
    expect(text).not.toMatch(/<|>|&|\u2028|\u2029/)
    expect(JSON.parse(text)).toEqual(value)
  })
})

describe('schema.org helpers', () => {
  it('organization', () => {
    expect(
      organizationLd({
        name: 'Acme',
        url: 'https://acme.example',
        logo: 'https://acme.example/l.png',
        sameAs: ['https://x.com/acme'],
      }),
    ).toEqual({
      '@type': 'Organization',
      name: 'Acme',
      url: 'https://acme.example',
      logo: 'https://acme.example/l.png',
      sameAs: ['https://x.com/acme'],
    })
  })
  it('website with a search action only when a template is given', () => {
    expect(webSiteLd({ name: 'Acme', url: 'https://acme.example' })).toEqual({
      '@type': 'WebSite',
      name: 'Acme',
      url: 'https://acme.example',
    })
    expect(
      webSiteLd({
        name: 'Acme',
        url: 'https://acme.example',
        searchUrlTemplate: 'https://acme.example/s?q={query}',
      }),
    ).toMatchObject({
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://acme.example/s?q={query}',
        'query-input': 'required name=query',
      },
    })
  })
  it('breadcrumbs are numbered from 1', () => {
    expect(
      breadcrumbLd([
        { name: 'Home', url: 'https://a.example/' },
        { name: 'Pricing', url: 'https://a.example/pricing' },
      ]),
    ).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://a.example/' },
        { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://a.example/pricing' },
      ],
    })
  })
  it('FAQ page: questions with accepted answers', () => {
    expect(faqLd([{ question: 'Free?', answer: 'Yes' }])).toEqual({
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes' } },
      ],
    })
  })
})
