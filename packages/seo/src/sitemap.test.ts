import { describe, expect, it } from 'vitest'
import { robotsTxt, sitemapXml } from './sitemap'

const base = 'https://notes.example.com'

describe('sitemapXml', () => {
  it('lists absolute, de-duplicated urls in order, with optional lastmod / changefreq / priority', () => {
    const xml = sitemapXml(
      [
        '/',
        '/pricing',
        { path: '/terms', lastmod: '2026-10-01', changefreq: 'yearly', priority: 0.3 },
        '/pricing#faq',
      ],
      { baseUrl: base },
    )
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(xml.match(/<loc>/g)).toHaveLength(3)
    expect(xml).toContain('<loc>https://notes.example.com/</loc>')
    expect(xml).toContain('<loc>https://notes.example.com/pricing</loc>')
    expect(xml).toContain(
      '<lastmod>2026-10-01</lastmod><changefreq>yearly</changefreq><priority>0.3</priority>',
    )
  })

  it('escapes XML in urls', () => {
    const xml = sitemapXml(['/search?a=1&b=<2>'], { baseUrl: base })
    expect(xml).toContain('<loc>https://notes.example.com/search?a=1&amp;b=%3C2%3E</loc>')
  })

  it('hreflang alternates add xhtml:link', () => {
    const xml = sitemapXml(
      [
        {
          path: '/',
          alternates: [
            { hreflang: 'ko', path: '/ko' },
            { hreflang: 'en', path: '/en' },
          ],
        },
      ],
      { baseUrl: base },
    )
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="ko" href="https://notes.example.com/ko"/>',
    )
  })

  it('refuses what search engines would refuse: another host, a bad date, a bad priority, a bad base, too many urls', () => {
    expect(() => sitemapXml(['https://evil.example/x'], { baseUrl: base })).toThrow(/same host/i)
    expect(() => sitemapXml([{ path: '/', lastmod: 'yesterday' }], { baseUrl: base })).toThrow(
      /lastmod/,
    )
    expect(() => sitemapXml([{ path: '/', priority: 2 }], { baseUrl: base })).toThrow(/priority/)
    expect(() => sitemapXml(['/'], { baseUrl: 'notes.example.com' })).toThrow(/baseUrl/)
    expect(() =>
      sitemapXml(
        Array.from({ length: 50_001 }, (_, i) => `/p${i}`),
        { baseUrl: base },
      ),
    ).toThrow(/50,?000/)
  })

  it('a base with a path prefix keeps it', () => {
    expect(sitemapXml(['/a'], { baseUrl: 'https://x.example/app/' })).toContain(
      '<loc>https://x.example/app/a</loc>',
    )
  })
})

describe('robotsTxt', () => {
  it('allows everything by default and points at the sitemap', () => {
    expect(robotsTxt({ baseUrl: base })).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://notes.example.com/sitemap.xml\n',
    )
  })
  it('allowIndexing:false blocks everyone (previews, staging) and names no sitemap', () => {
    expect(robotsTxt({ baseUrl: base, allowIndexing: false })).toBe('User-agent: *\nDisallow: /\n')
  })
  it('rules per agent, and sitemap:false', () => {
    const text = robotsTxt({
      baseUrl: base,
      sitemap: false,
      rules: [
        { userAgent: '*', disallow: ['/account', '/api/'] },
        { userAgent: 'GPTBot', disallow: ['/'] },
      ],
    })
    expect(text).toBe(
      'User-agent: *\nDisallow: /account\nDisallow: /api/\n\nUser-agent: GPTBot\nDisallow: /\n',
    )
  })
  it('no baseUrl means no Sitemap line (it must be absolute)', () => {
    expect(robotsTxt({})).toBe('User-agent: *\nAllow: /\n')
  })
  it('refuses values that could add a line (header-injection style)', () => {
    expect(() => robotsTxt({ rules: [{ userAgent: '*\nDisallow: /', disallow: [] }] })).toThrow(
      /line break/i,
    )
    expect(() => robotsTxt({ rules: [{ userAgent: '*', disallow: ['/a\r\nAllow: /'] }] })).toThrow(
      /line break/i,
    )
    expect(() => robotsTxt({ rules: [{ userAgent: '*', disallow: ['nope'] }] })).toThrow(
      /start with/,
    )
  })
})
