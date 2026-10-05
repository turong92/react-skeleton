import type { RouteObject } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { seoDefaults, seoMetaOf } from './routeMeta'

const chain = (handle: object): RouteObject[] => [{ path: '/', handle }]

describe('seoMetaOf — a route handle becomes the page SEO', () => {
  it('title and description from the innermost handle, canonical = the pathname', () => {
    expect(seoMetaOf(chain({ title: 'Pricing', description: 'Plans' }), '/pricing')).toEqual({
      title: 'Pricing',
      description: 'Plans',
      canonical: '/pricing',
      robots: undefined,
      image: undefined,
      jsonLd: undefined,
    })
  })

  it('a noindex page has no canonical, and robots passes through', () => {
    const meta = seoMetaOf(
      chain({ title: 'Account', description: 'x', robots: 'noindex' }),
      '/account',
    )
    expect(meta.robots).toBe('noindex')
    expect(meta.canonical).toBeUndefined()
  })

  it('image and JSON-LD pass through', () => {
    const jsonLd = { '@type': 'Organization', name: 'Acme' }
    const meta = seoMetaOf(chain({ title: 't', description: 'd', image: '/og.png', jsonLd }), '/')
    expect(meta.image).toBe('/og.png')
    expect(meta.jsonLd).toEqual(jsonLd)
  })

  it('no handle at all (an unmatched route): the site name is the title', () => {
    expect(seoMetaOf([], '/x').title).toBeUndefined()
  })
})

describe('seoDefaults', () => {
  it('names the site after the app, templates titles as "<page> · <app>", and carries SITE_URL as baseUrl', () => {
    const defaults = seoDefaults('https://app.example.com')
    expect(defaults.titleTemplate?.startsWith('%s · ')).toBe(true)
    expect(defaults.baseUrl).toBe('https://app.example.com')
    expect(seoDefaults(undefined).baseUrl).toBeUndefined()
  })
})
