import { describe, expect, it } from 'vitest'
import {
  buildHead,
  escapeHtml,
  readSiteUrl,
  readSsrState,
  serializeState,
  SITE_URL_META,
  SSR_STATE_ID,
} from './head'

describe('escapeHtml', () => {
  it('escapes the five characters that can break out of text or an attribute', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;',
    )
  })
})

describe('serializeState — the dehydrated query cache inside the page', () => {
  it('is JSON that cannot close the script element or start a comment', () => {
    const out = serializeState({ message: '</script><script>alert(1)</script><!--' })
    expect(out).not.toContain('</script')
    expect(out).not.toContain('<!--')
    expect(JSON.parse(out)).toEqual({ message: '</script><script>alert(1)</script><!--' })
  })

  it('survives the line separators that are legal in JSON and illegal in older script parsers', () => {
    const out = serializeState('a\u2028b\u2029c')
    expect(out).not.toMatch(/[\u2028\u2029]/)
    expect(JSON.parse(out)).toBe('a\u2028b\u2029c')
  })
})

describe('buildHead — the seo head plus the state for the client', () => {
  const spec = {
    title: 'A & B <1>',
    tags: [{ tag: 'meta' as const, attrs: { name: 'description', content: 'say "hi"' } }],
  }

  it('has the seo head (escaped), and a JSON script with a known id', () => {
    const head = buildHead({ spec, state: { queries: [] } })
    expect(head).toContain('<title>A &amp; B &lt;1&gt;</title>')
    expect(head).toContain('<meta name="description" content="say &quot;hi&quot;" data-seo />')
    expect(head).toContain(
      `<script type="application/json" id="${SSR_STATE_ID}">{"queries":[]}</script>`,
    )
  })

  it('tells the browser the public address (so client-side navigation writes the same canonical) only when there is one', () => {
    expect(buildHead({ spec, state: {} })).not.toContain(SITE_URL_META)
    expect(buildHead({ spec, state: {}, siteUrl: 'https://notes.example.com' })).toContain(
      `<meta name="${SITE_URL_META}" content="https://notes.example.com" />`,
    )
  })
})

describe('readSiteUrl — the client side of the same contract', () => {
  it('reads what buildHead wrote, and nothing when it is missing', () => {
    expect(
      readSiteUrl({ querySelector: () => ({ getAttribute: () => 'https://notes.example.com' }) }),
    ).toBe('https://notes.example.com')
    expect(readSiteUrl({ querySelector: () => null })).toBeUndefined()
  })
})

describe('readSsrState — the client side of the same contract', () => {
  it('parses what serializeState wrote, and says nothing when the element is missing', () => {
    const value = { queries: [{ queryKey: ['hello'] }] }
    expect(
      readSsrState({ getElementById: () => ({ textContent: serializeState(value) }) }),
    ).toEqual(value)
    expect(readSsrState({ getElementById: () => null })).toBeUndefined()
    expect(readSsrState({ getElementById: () => ({ textContent: '{not json' }) })).toBeUndefined()
  })
})
