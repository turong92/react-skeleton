import { describe, expect, it } from 'vitest'
import { applyHead, type DocumentLike } from './applyHead'
import { renderHeadHtml } from './renderHead'
import type { HeadSpec } from './headSpec'

const spec: HeadSpec = {
  title: 'A & B <1>',
  tags: [
    { tag: 'meta', attrs: { name: 'description', content: 'say "hi"' } },
    { tag: 'link', attrs: { rel: 'canonical', href: 'https://a.example/?x=1&y=2' } },
    { tag: 'script', attrs: { type: 'application/ld+json' }, text: '{"a":"\\u003c/script>"}' },
  ],
}

describe('renderHeadHtml (server)', () => {
  it('escapes the title and every attribute, marks each tag data-seo, and leaves JSON-LD text as serialised', () => {
    const html = renderHeadHtml(spec)
    expect(html).toContain('<title>A &amp; B &lt;1&gt;</title>')
    expect(html).toContain('<meta name="description" content="say &quot;hi&quot;" data-seo />')
    expect(html).toContain(
      '<link rel="canonical" href="https://a.example/?x=1&amp;y=2" data-seo />',
    )
    expect(html).toContain(
      '<script type="application/ld+json" data-seo>{"a":"\\u003c/script>"}</script>',
    )
  })
})

type FakeEl = {
  tag: string
  attrs: Record<string, string>
  textContent: string | null
  removed: boolean
  remove(): void
  setAttribute(n: string, v: string): void
}
function fakeDocument(existing: FakeEl[] = []) {
  const head: FakeEl[] = [...existing]
  const doc = {
    title: 'old',
    head: {
      querySelectorAll: (selector: string) =>
        head.filter((el) => selector === '[data-seo]' && 'data-seo' in el.attrs),
      appendChild: (el: FakeEl) => void head.push(el),
    },
    createElement: (tag: string): FakeEl => {
      const el: FakeEl = {
        tag,
        attrs: {},
        textContent: null,
        removed: false,
        remove() {
          this.removed = true
          head.splice(head.indexOf(this), 1)
        },
        setAttribute(name, value) {
          this.attrs[name] = value
        },
      }
      return el
    },
  }
  return { doc: doc as unknown as DocumentLike, head }
}

describe('applyHead (browser)', () => {
  it('sets the title and replaces only the tags it made earlier (data-seo), never the others', () => {
    const keep: FakeEl = {
      tag: 'meta',
      attrs: { charset: 'utf-8' },
      textContent: null,
      removed: false,
      remove() {},
      setAttribute() {},
    }
    const old: FakeEl = {
      tag: 'meta',
      attrs: { 'data-seo': '', name: 'robots' },
      textContent: null,
      removed: false,
      remove() {
        this.removed = true
        head.splice(head.indexOf(this), 1)
      },
      setAttribute() {},
    }
    const { doc, head } = fakeDocument([keep, old])
    applyHead(spec, doc)
    expect(doc.title).toBe('A & B <1>')
    expect(old.removed).toBe(true)
    expect(head).toContain(keep)
    const made = head.filter((el) => 'data-seo' in el.attrs)
    expect(made.map((el) => el.tag)).toEqual(['meta', 'link', 'script'])
    expect(made[0].attrs).toMatchObject({ name: 'description', content: 'say "hi"' })
    expect(made[2].textContent).toBe('{"a":"\\u003c/script>"}')
  })

  it('applying twice does not pile up tags', () => {
    const { doc, head } = fakeDocument()
    applyHead(spec, doc)
    applyHead(spec, doc)
    expect(head.filter((el) => 'data-seo' in el.attrs)).toHaveLength(3)
  })
})
