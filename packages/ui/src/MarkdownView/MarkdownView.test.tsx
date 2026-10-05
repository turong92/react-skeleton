import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkdownView } from './MarkdownView'

const html = (source: string, props: Partial<Parameters<typeof MarkdownView>[0]> = {}) =>
  renderToStaticMarkup(<MarkdownView source={source} {...props} />)

describe('MarkdownView', () => {
  it('renders headings with anchors, paragraphs, lists, emphasis and tables', () => {
    const out = html(
      '# Terms\n\nHello **bold** and *em*.\n\n- one\n- two\n\n1. first\n\n| A | B |\n|:--|--:|\n| 1 | 2 |',
    )
    expect(out).toMatch(/<h1[^>]*id="terms"[^>]*>Terms<\/h1>/)
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('<em>em</em>')
    expect(out).toMatch(/<ul[^>]*><li[^>]*>one<\/li>/)
    expect(out).toMatch(/<ol/)
    expect(out).toMatch(/<th[^>]*scope="col"[^>]*data-align="left"[^>]*>A<\/th>/)
    expect(out).toMatch(/<td[^>]*data-align="right"[^>]*>2<\/td>/)
  })

  it('headingOffset shifts levels (a page that already has its own h1), capped at h6', () => {
    expect(html('# A\n\n###### Z', { headingOffset: 1 })).toMatch(
      /<h2[^>]*>A<\/h2>.*<h6[^>]*>Z<\/h6>/,
    )
  })

  it('external links open in a new tab with noopener noreferrer and say so to screen readers; relative and mailto links do not', () => {
    const out = html('[ext](https://example.com) [rel](/privacy) [mail](mailto:a@example.com)', {
      newTabLabel: '(opens in a new tab)',
    })
    expect(out).toMatch(
      /<a[^>]*href="https:\/\/example.com"[^>]*rel="noopener noreferrer"[^>]*target="_blank"|<a[^>]*target="_blank"[^>]*rel="noopener noreferrer"/,
    )
    expect(out).toContain('(opens in a new tab)')
    expect(out.match(/target="_blank"/g)).toHaveLength(1)
    expect(out).toMatch(/<a[^>]*href="\/privacy"/)
  })

  it('externalLinkTarget="self" keeps everything in the same tab but still adds rel', () => {
    const out = html('[ext](https://example.com)', { externalLinkTarget: 'self' })
    expect(out).not.toContain('target=')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('an unsafe link is plain text — no anchor, no href', () => {
    const out = html('[click](javascript:alert(1))')
    expect(out).not.toContain('<a')
    expect(out).not.toContain('javascript')
    expect(out).toContain('click')
  })

  it('raw HTML is shown as text, not run', () => {
    const out = html('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('substitutes {{placeholders}} from the facts map as text (a value cannot add markup)', () => {
    const out = html('Operated by {{company}}. Contact {{email}}.', {
      facts: { company: '<b>Acme</b> & Co', email: '[x](javascript:alert(1))' },
    })
    expect(out).toContain('&lt;b&gt;Acme&lt;/b&gt; &amp; Co')
    expect(out).not.toContain('<b>')
    expect(out).not.toContain('<a')
  })

  it('a missing fact stays visible as a marked placeholder so nobody ships an unfilled document', () => {
    const out = html('Hello {{missing}}', { facts: {} })
    expect(out).toMatch(/<mark[^>]*data-missing="missing"[^>]*>\{\{missing\}\}<\/mark>/)
  })

  it('a fact can fill a link address (mailto:{{email}}) — and the filled address is checked again', () => {
    const out = html(
      '[mail](mailto:{{email}}) [site]({{site}}) [bad]({{evil}}) [gone]({{nothing}})',
      {
        facts: {
          email: 'help@example.com',
          site: 'https://example.com',
          evil: 'javascript:alert(1)',
        },
      },
    )
    expect(out).toContain('href="mailto:help@example.com"')
    expect(out).toContain('href="https://example.com"')
    expect(out).not.toContain('javascript')
    expect(out.match(/<a /g)).toHaveLength(2)
    // 못 채운 주소의 링크는 링크가 아니라 글자 — 깨진 링크를 내보내지 않는다
    expect(out).toContain('gone')
  })

  it('numbers in facts render as text', () => {
    expect(html('{{n}} days', { facts: { n: 14 } })).toContain('14 days')
  })
})
