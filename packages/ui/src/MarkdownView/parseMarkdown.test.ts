import { describe, expect, it } from 'vitest'
import { parseMarkdown, placeholdersOf, safeHref, slugify } from './parseMarkdown'

describe('safeHref', () => {
  it.each([
    ['https://example.com/a?b=1&c=2', 'https://example.com/a?b=1&c=2'],
    ['http://example.com', 'http://example.com'],
    ['mailto:help@example.com', 'mailto:help@example.com'],
    ['tel:+82-2-123-4567', 'tel:+82-2-123-4567'],
    ['/terms', '/terms'],
    ['/privacy#cookies', '/privacy#cookies'],
    ['#section', '#section'],
    ['?page=2', '?page=2'],
    ['./relative', './relative'],
    ['../up', '../up'],
  ])('allows %s', (raw, expected) => expect(safeHref(raw)).toBe(expected))

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    ' javascript:alert(1)',
    '\u0001javascript:alert(1)',
    'data:text/html;base64,AAAA',
    'vbscript:msgbox(1)',
    '//evil.example.com',
    '\\\\evil.example.com',
    'file:///etc/passwd',
    'ftp://example.com',
    'blob:https://example.com/x',
    'https://exa mple.com',
    'https://example.com/"onmouseover="x',
    '',
  ])('rejects %j', (raw) => expect(safeHref(raw)).toBeNull())
})

describe('slugify', () => {
  it('makes stable anchors (keeps Hangul)', () => {
    expect(slugify('1. Terms of Use')).toBe('1-terms-of-use')
    expect(slugify('제3조 (개인정보)')).toBe('제3조-개인정보')
    expect(slugify('   ')).toBe('section')
  })
})

describe('placeholdersOf', () => {
  it('lists each {{key}} once, in order, ignoring code spans', () => {
    expect(placeholdersOf('Hi {{ name }} at {{company}}, {{name}} `{{literal}}`')).toEqual([
      'name',
      'company',
    ])
  })
})

describe('parseMarkdown blocks', () => {
  it('headings, paragraphs (soft-wrapped lines join), rules', () => {
    const blocks = parseMarkdown('# Title\n\nfirst line\nsecond line\n\n---\n\n###### Deep')
    expect(blocks.map((b) => b.t)).toEqual(['heading', 'paragraph', 'rule', 'heading'])
    expect(blocks[0]).toMatchObject({ t: 'heading', level: 1 })
    expect(blocks[1]).toMatchObject({
      t: 'paragraph',
      c: [{ t: 'text', v: 'first line second line' }],
    })
    expect(blocks[3]).toMatchObject({ level: 6 })
  })

  it('unordered and ordered lists, with one nested level', () => {
    const blocks = parseMarkdown('- a\n- b\n  - b1\n  - b2\n- c\n\n1. one\n2. two')
    expect(blocks[0]).toMatchObject({ t: 'list', ordered: false })
    const first = blocks[0] as Extract<(typeof blocks)[number], { t: 'list' }>
    expect(first.items).toHaveLength(3)
    expect(first.items[1].children?.[0]).toMatchObject({ t: 'list', ordered: false })
    expect(blocks[1]).toMatchObject({ t: 'list', ordered: true })
  })

  it('tables with alignment; a pipe line without a delimiter row is a paragraph', () => {
    const table = parseMarkdown(
      '| Name | Price |\n|:-----|------:|\n| Pro | 10 |\n| Team | 20 |',
    )[0]
    expect(table).toMatchObject({ t: 'table', align: ['left', 'right'] })
    expect((table as Extract<typeof table, { t: 'table' }>).rows).toHaveLength(2)
    expect(parseMarkdown('| not | a table |')[0].t).toBe('paragraph')
  })

  it('raw HTML is just text — nothing in it becomes structure', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>\n\n<div onclick="x">hi</div>')
    expect(blocks.map((b) => b.t)).toEqual(['paragraph', 'paragraph'])
    expect(JSON.stringify(blocks)).toContain('<script>')
  })
})

describe('parseMarkdown inline', () => {
  const inline = (text: string) => (parseMarkdown(text)[0] as { c: unknown[] }).c
  it('emphasis, strong, code, escapes', () => {
    expect(inline('a **b** *c* `d` \\*e\\*')).toEqual([
      { t: 'text', v: 'a ' },
      { t: 'strong', c: [{ t: 'text', v: 'b' }] },
      { t: 'text', v: ' ' },
      { t: 'em', c: [{ t: 'text', v: 'c' }] },
      { t: 'text', v: ' ' },
      { t: 'code', v: 'd' },
      { t: 'text', v: ' *e*' },
    ])
  })
  it('snake_case words are not emphasised', () => {
    expect(inline('use contact_email_address here')).toEqual([
      { t: 'text', v: 'use contact_email_address here' },
    ])
  })
  it('links keep a safe href and drop an unsafe one (the text stays)', () => {
    expect(inline('[ok](https://example.com)')).toEqual([
      { t: 'link', href: 'https://example.com', c: [{ t: 'text', v: 'ok' }] },
    ])
    expect(inline('[bad](javascript:alert(1))')).toEqual([{ t: 'text', v: 'bad' }])
  })
  it('an address with a placeholder is kept for the renderer to fill and check (marked dynamic)', () => {
    expect(inline('[mail](mailto:{{email}})')).toEqual([
      { t: 'link', href: 'mailto:{{email}}', dynamic: true, c: [{ t: 'text', v: 'mail' }] },
    ])
  })
  it('placeholders become nodes, but not inside code', () => {
    expect(inline('Hi {{ name }} `{{x}}`')).toEqual([
      { t: 'text', v: 'Hi ' },
      { t: 'placeholder', key: 'name' },
      { t: 'text', v: ' ' },
      { t: 'code', v: '{{x}}' },
    ])
  })
  it('deep nesting does not blow the stack', () => {
    expect(() => parseMarkdown('**'.repeat(20000) + 'x')).not.toThrow()
    expect(() => parseMarkdown('['.repeat(20000))).not.toThrow()
  })
})
