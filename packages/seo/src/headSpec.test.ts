import { describe, expect, it } from 'vitest'
import { buildHeadSpec } from './headSpec'

const defaults = {
  siteName: 'Notes',
  titleTemplate: '%s · Notes',
  baseUrl: 'https://notes.example.com',
  description: 'Notes for teams',
  locale: 'en_US',
}
const meta = (spec: ReturnType<typeof buildHeadSpec>, key: string) =>
  spec.tags.find((tag) => tag.attrs.name === key || tag.attrs.property === key)?.attrs.content
const link = (spec: ReturnType<typeof buildHeadSpec>, rel: string) =>
  spec.tags.filter((tag) => tag.tag === 'link' && tag.attrs.rel === rel).map((tag) => tag.attrs)

describe('buildHeadSpec — title', () => {
  it('fills the template, falls back to the site name, never doubles it', () => {
    expect(buildHeadSpec({ title: 'Pricing' }, defaults).title).toBe('Pricing · Notes')
    expect(buildHeadSpec({}, defaults).title).toBe('Notes')
    expect(buildHeadSpec({ title: 'Notes' }, defaults).title).toBe('Notes')
  })
  it('the template is only a template: a title with $& or %s in it is inserted as-is', () => {
    expect(buildHeadSpec({ title: 'Save $& more %s' }, defaults).title).toBe(
      'Save $& more %s · Notes',
    )
  })
  it('without a template the title is the title', () => {
    expect(buildHeadSpec({ title: 'Pricing' }, { siteName: 'Notes' }).title).toBe('Pricing')
  })
})

describe('buildHeadSpec — description, canonical, robots', () => {
  it('description: the page one wins over the default; whitespace is collapsed; none → no tag', () => {
    expect(meta(buildHeadSpec({ description: ' a \n  b ' }, defaults), 'description')).toBe('a b')
    expect(meta(buildHeadSpec({}, defaults), 'description')).toBe('Notes for teams')
    expect(meta(buildHeadSpec({}, { siteName: 'x' }), 'description')).toBeUndefined()
  })

  it('canonical is absolute against baseUrl, drops the #hash, and is omitted when it cannot be absolute', () => {
    expect(link(buildHeadSpec({ canonical: '/pricing#faq' }, defaults), 'canonical')).toEqual([
      { rel: 'canonical', href: 'https://notes.example.com/pricing' },
    ])
    expect(
      link(buildHeadSpec({ canonical: 'https://other.example/a' }, defaults), 'canonical')[0].href,
    ).toBe('https://other.example/a')
    expect(link(buildHeadSpec({ canonical: '/pricing' }, { siteName: 'x' }), 'canonical')).toEqual(
      [],
    )
    expect(
      link(buildHeadSpec({ canonical: 'javascript:alert(1)' }, defaults), 'canonical'),
    ).toEqual([])
  })

  it('robots passes through only when set', () => {
    expect(meta(buildHeadSpec({ robots: 'noindex, nofollow' }, defaults), 'robots')).toBe(
      'noindex, nofollow',
    )
    expect(meta(buildHeadSpec({}, defaults), 'robots')).toBeUndefined()
  })
})

describe('buildHeadSpec — Open Graph and Twitter', () => {
  it('shares the page title (not the templated one), description, url, site name, locale', () => {
    const spec = buildHeadSpec(
      { title: 'Pricing', description: 'Plans', canonical: '/pricing' },
      defaults,
    )
    expect(meta(spec, 'og:title')).toBe('Pricing')
    expect(meta(spec, 'og:description')).toBe('Plans')
    expect(meta(spec, 'og:url')).toBe('https://notes.example.com/pricing')
    expect(meta(spec, 'og:site_name')).toBe('Notes')
    expect(meta(spec, 'og:type')).toBe('website')
    expect(meta(spec, 'og:locale')).toBe('en_US')
    expect(meta(spec, 'twitter:title')).toBe('Pricing')
  })

  it('an image upgrades the Twitter card and is made absolute', () => {
    const none = buildHeadSpec({}, defaults)
    expect(meta(none, 'twitter:card')).toBe('summary')
    expect(meta(none, 'og:image')).toBeUndefined()
    const spec = buildHeadSpec({ image: '/og.png', imageAlt: 'Logo' }, defaults)
    expect(meta(spec, 'twitter:card')).toBe('summary_large_image')
    expect(meta(spec, 'og:image')).toBe('https://notes.example.com/og.png')
    expect(meta(spec, 'og:image:alt')).toBe('Logo')
    expect(meta(spec, 'twitter:image')).toBe('https://notes.example.com/og.png')
  })

  it('twitter:site only when configured', () => {
    expect(meta(buildHeadSpec({}, defaults), 'twitter:site')).toBeUndefined()
    expect(meta(buildHeadSpec({}, { ...defaults, twitterSite: '@notes' }), 'twitter:site')).toBe(
      '@notes',
    )
  })
})

describe('buildHeadSpec — alternates and JSON-LD', () => {
  it('hreflang alternates become absolute links', () => {
    const spec = buildHeadSpec(
      {
        alternates: [
          { hreflang: 'ko', href: '/ko' },
          { hreflang: 'en', href: '/en' },
        ],
      },
      defaults,
    )
    expect(link(spec, 'alternate')).toEqual([
      { rel: 'alternate', hreflang: 'ko', href: 'https://notes.example.com/ko' },
      { rel: 'alternate', hreflang: 'en', href: 'https://notes.example.com/en' },
    ])
  })

  it('each JSON-LD node is one script with @context, serialised so it cannot close the script', () => {
    const spec = buildHeadSpec(
      { jsonLd: [{ '@type': 'Organization', name: '</script><script>alert(1)</script>' }] },
      defaults,
    )
    const scripts = spec.tags.filter((tag) => tag.tag === 'script')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].attrs.type).toBe('application/ld+json')
    expect(scripts[0].text).not.toContain('</script')
    expect(JSON.parse(scripts[0].text!)).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: '</script><script>alert(1)</script>',
    })
  })
})
