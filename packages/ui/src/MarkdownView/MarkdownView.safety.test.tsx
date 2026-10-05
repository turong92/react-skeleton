import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkdownView } from './MarkdownView'

/*
 * 속성 시험(property test) — 무작위로 이어 붙인 적대적 마크다운이 어떤 모양이든 출력이 안전해야 한다.
 * 라이브러리(fast-check)를 들이지 않고 씨앗 고정 난수로 돌린다(실패하면 같은 입력이 다시 나온다).
 */
const ALLOWED_TAGS = new Set([
  'div',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'strong',
  'em',
  'code',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'mark',
  'span',
])
const ALLOWED_ATTRS = new Set([
  'class',
  'id',
  'href',
  'rel',
  'target',
  'scope',
  'data-align',
  'data-missing',
])
const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#|\?|\.\.?\/)/

const PIECES = [
  '<script>alert(1)</script>',
  '</script><script>alert(2)',
  '<img src=x onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '<iframe srcdoc="<script>1</script>">',
  '<a href="javascript:alert(1)">x</a>',
  '[x](javascript:alert(1))',
  '[x](JaVaScRiPt:alert(1))',
  '[x](java\tscript:alert(1))',
  '[x](java\nscript:alert(1))',
  '[x](&#106;avascript:alert(1))',
  '[x](data:text/html;base64,PHNjcmlwdD4=)',
  '[x](vbscript:msgbox(1))',
  '[x](//evil.example.com)',
  '[x](https://ok.example/a?b=1&c=2)',
  '[x](/relative/path#frag)',
  '[x](<javascript:alert(1)>)',
  '[x]({{evil}})',
  '[x](mailto:{{name}})',
  '[x](https://ok.example/{{name}})',
  '[x](https://a.example/"onmouseover="alert(1))',
  '![img](x" onerror="alert(1))',
  '[[x](javascript:alert(1))](https://ok.example)',
  '**',
  '*',
  '_',
  '__',
  '`',
  '``',
  '[',
  ']',
  '(',
  ')',
  '\\',
  '\n',
  '\n\n',
  '\r\n',
  '# ',
  '###### ',
  '####### too deep',
  '- ',
  '  - ',
  '1. ',
  '| a | b |',
  '|---|:-:|',
  '|',
  '---',
  '{{name}}',
  '{{evil}}',
  '{{ }}',
  '{{',
  '}}',
  '&lt;',
  '&amp;',
  '&#x3C;script&#x3E;',
  '"',
  "'",
  '>',
  '<',
  ' ',
  '\u0000',
  '\u202e',
  '\u2028',
  '😀',
  '한글 문서',
  'plain text',
]

/** mulberry32 — 씨앗 고정 */
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function problemsIn(out: string): string[] {
  const problems: string[] = []
  for (const tag of out.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g)) {
    const [, , name, rest] = tag
    if (!ALLOWED_TAGS.has(name.toLowerCase())) problems.push(`tag <${name}>`)
    for (const attr of rest.matchAll(/\s([^\s=/>"']+)(?:=("[^"]*"|'[^']*'|[^\s>]*))?/g)) {
      const attrName = attr[1].toLowerCase()
      if (!ALLOWED_ATTRS.has(attrName)) problems.push(`attribute ${attrName} on <${name}>`)
      if (attrName === 'href') {
        const value = (attr[2] ?? '').slice(1, -1).replace(/&amp;/g, '&')
        // eslint-disable-next-line no-control-regex -- 제어 문자를 찾는 것이 목적이다
        if (!SAFE_HREF.test(value) || /[\s\u0000-\u001f]/.test(value))
          problems.push(`href ${value}`)
      }
      if (attrName === 'target' && !/rel="[^"]*noopener/.test(rest))
        problems.push('target without noopener')
    }
  }
  // 태그가 아닌 곳에 날 `<` 가 남으면 안 된다(텍스트는 `&lt;` 로 나온다)
  if (/<(?![/a-zA-Z])/.test(out.replace(/<\/?[a-zA-Z][^>]*>/g, ''))) problems.push('bare <')
  return problems
}

describe('MarkdownView is safe against hostile input (property test)', () => {
  const facts = { name: '<script>alert(1)</script>', evil: '[x](javascript:alert(1))' }

  it('2000 random documents: only allowed tags and attributes, only safe hrefs, no script', () => {
    const random = rng(20261006)
    for (let run = 0; run < 2000; run += 1) {
      const count = 1 + Math.floor(random() * 40)
      let source = ''
      for (let i = 0; i < count; i += 1) source += PIECES[Math.floor(random() * PIECES.length)]
      const out = renderToStaticMarkup(<MarkdownView source={source} facts={facts} />)
      const problems = problemsIn(out)
      expect(problems, `source ${JSON.stringify(source)}\n→ ${out}`).toEqual([])
      expect(out.toLowerCase()).not.toContain('<script')
    }
  })

  it('every hostile piece on its own, and doubled up in a link/heading/list/table context', () => {
    for (const piece of PIECES) {
      for (const wrap of [
        '%',
        '# %',
        '- %',
        '1. %',
        '| % | b |\n|---|---|\n| % | % |',
        '**%**',
        '[%](https://ok.example)',
        '[ok](%)',
      ]) {
        const out = renderToStaticMarkup(
          <MarkdownView source={wrap.replace(/%/g, piece)} facts={facts} />,
        )
        expect(
          problemsIn(out),
          `${JSON.stringify(wrap)} with ${JSON.stringify(piece)} → ${out}`,
        ).toEqual([])
      }
    }
  })
})
