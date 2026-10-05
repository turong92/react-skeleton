import { describe, expect, it } from 'vitest'
import { buildHead, escapeHtml, readSsrState, serializeState, SSR_STATE_ID } from './head'

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

describe('buildHead — title, description and the state for the client', () => {
  it('has a title, a meta description and a JSON script with a known id; texts are escaped', () => {
    const head = buildHead({
      title: 'A & B <1>',
      description: 'say "hi"',
      state: { queries: [] },
    })
    expect(head).toContain('<title>A &amp; B &lt;1&gt;</title>')
    expect(head).toContain('<meta name="description" content="say &quot;hi&quot;" />')
    expect(head).toContain(
      `<script type="application/json" id="${SSR_STATE_ID}">{"queries":[]}</script>`,
    )
    expect(head).not.toContain('robots')
  })

  it('adds a robots meta only when a page asks for it (the account and 404 pages)', () => {
    expect(buildHead({ title: 't', description: 'd', robots: 'noindex', state: {} })).toContain(
      '<meta name="robots" content="noindex" />',
    )
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
