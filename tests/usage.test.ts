import { findRawColors, findRawLayout } from '@skeleton/tokens'
import { describe, expect, it } from 'vitest'
import { LAYOUT_EXEMPT } from './support/layoutExempt'
import { loadWorkspaces } from './support/loadWorkspaces'

/*
 * 화면 코드가 토큰 층을 지키는지 — 날 색 금지 · 원시(--p-*) 직접 사용 금지 · 쓰는 var(--x) 는 모두 정의됨.
 * 두 앱(apps/*)과 모든 패키지(packages/*)의 CSS · TSX 를 본다. 생성 파일 packages/tokens/tokens.css 는 값을 정의하는 곳이라 대상에서 뺀다.
 */
const GENERATED = 'packages/tokens/tokens.css'
const workspaces = loadWorkspaces()
const all = workspaces.flatMap((ws) =>
  ws.files.map((f) => ({ ws: ws.dir, file: `${ws.dir}/${f.path}`, text: f.text })),
)
const screenCss = all.filter((f) => f.file.endsWith('.css') && f.file !== GENERATED)
const screenTsx = all.filter((f) => f.file.endsWith('.tsx') && !f.file.endsWith('.test.tsx'))
const generatedText = all.find((f) => f.file === GENERATED)!.text

describe('screen code', () => {
  it('there is screen CSS and TSX to check (the scanner is not looking at an empty list)', () => {
    expect(screenCss.length).toBeGreaterThan(0)
    expect(screenTsx.length).toBeGreaterThan(0)
  })

  it.each(screenCss.map((f) => [f.file, f.text]))('%s has no raw colour values', (_, text) => {
    expect(findRawColors(text)).toEqual([])
  })

  it.each(screenTsx.map((f) => [f.file, f.text]))(
    '%s has no raw colour in inline styles',
    (_, text) => {
      expect(findRawColors(text)).toEqual([])
    },
  )

  it('does not use primitives (--p-*) directly', () => {
    const offenders = [...screenCss, ...screenTsx].filter((f) => /var\(\s*--p-/.test(f.text))
    expect(offenders.map((f) => f.file)).toEqual([])
  })

  it('every var(--x) used in apps and packages is defined in tokens.css', () => {
    const defined = new Set([...generatedText.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    const used = new Map<string, string>()
    for (const f of [...screenCss, ...screenTsx])
      for (const m of f.text.matchAll(/var\(\s*(--[\w-]+)/g)) used.set(m[1], f.file)
    const undefinedVars = [...used]
      .filter(([name]) => !defined.has(name))
      .map(([n, f]) => `${n} (${f})`)
    expect(undefinedVars).toEqual([])
  })
})

/*
 * 간격 · 모서리 · 글자 크기도 날값(px · rem · em)을 쓰지 않고 의미 토큰(--space-* · --radius-* · --font-size-*)만 쓴다.
 * 예외 앱 목록은 tests/support/layoutExempt.ts(이 레포에서는 워크벤치뿐 — tests/skeleton.repo.test.ts 가 확인한다).
 */
const layoutScope = [...screenCss, ...screenTsx].filter((f) => !LAYOUT_EXEMPT.includes(f.ws))

describe('layout values come from tokens', () => {
  it.each(layoutScope.map((f) => [f.file, f.text]))(
    '%s has no raw padding / margin / gap / radius / font-size lengths',
    (_, text) => {
      expect(findRawLayout(text)).toEqual([])
    },
  )
})
