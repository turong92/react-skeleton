/// <reference types="node" />
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { build } from '../build.mjs'
import { cssBlocks, expandVars, themeVars } from './themeVars'

/*
 * 디자인 토큰 정본(tokens.json) → 생성물(tokens.css). docs/design-tokens.md 표 구역의 일치는 루트 tests/tokens.docs.test.ts.
 * 생성물을 손으로 고치면 「정본에서 다시 만든 결과 ≠ 커밋된 파일」로 빨간 불이다 — 고칠 땐 tokens.json 을 고치고 `pnpm tokens`.
 */
const REPO = fileURLToPath(new URL('../', import.meta.url))
const read = (path: string) => readFileSync(join(REPO, path), 'utf8')
const tokensJson = JSON.parse(read('tokens.json')) as Record<string, unknown>
const out = build({ write: false })

describe('generated files equal what the generator makes from tokens.json', () => {
  it('tokens.css', () => {
    expect(read('tokens.css'), 'drifted — run `pnpm tokens`').toBe(out.css)
  })

  it('the css header says not to edit', () => {
    expect(read('tokens.css')).toMatch(/^\/\* GENERATED — do not edit/)
  })

  it('`node build.mjs --check` exits 0 on the committed files', () => {
    const result = spawnSync(process.execPath, [join(REPO, 'build.mjs'), '--check'], {
      encoding: 'utf8',
    })
    expect(result.status, result.stderr).toBe(0)
  })
})

describe('tokens.json format (W3C Design Tokens draft)', () => {
  it('every leaf has $value and a $type (own or inherited) and css names are unique', () => {
    const names = new Set<string>()
    for (const t of out.tokens) {
      expect(t.type, t.path).toBeTruthy()
      expect(names.has(t.cssName), `duplicate ${t.cssName}`).toBe(false)
      names.add(t.cssName)
    }
  })

  it('only two layers: primitive (--p-*) and semantic (plain names); no component layer', () => {
    expect(new Set(out.tokens.map((t) => t.layer))).toEqual(new Set(['primitive', 'semantic']))
    for (const t of out.tokens) {
      if (t.layer === 'primitive') expect(t.cssName.startsWith('--p-'), t.path).toBe(true)
      else expect(t.cssName.startsWith('--p-'), t.path).toBe(false)
    }
    expect(Object.keys(tokensJson)).not.toContain('component')
  })

  it('primitives hold values only — they never reference other tokens', () => {
    for (const t of out.tokens.filter((t) => t.layer === 'primitive'))
      expect(t.references, t.path).toEqual([])
  })

  it('semantic tokens are references, never raw colours (light or any theme)', () => {
    const raw = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i
    for (const t of out.tokens.filter((t) => t.layer === 'semantic')) {
      expect(raw.test(t.raw), `${t.path} = ${t.raw}`).toBe(false)
      for (const v of Object.values(t.byTheme))
        expect(raw.test(v.raw ?? ''), `${t.path} theme value`).toBe(false)
    }
  })

  it('every semantic colour that points straight at a primitive has a dark value', () => {
    const missing = out.tokens
      .filter((t) => t.layer === 'semantic' && t.type === 'color')
      .filter((t) => t.references.length === 1 && t.references[0].startsWith('color.'))
      .filter((t) => t.byTheme.dark.raw === null)
      .map((t) => t.cssName)
    expect(missing).toEqual([])
  })

  it('uses the neutral $extensions.skeleton key and nothing project-specific leaked in', () => {
    const json = JSON.stringify(tokensJson)
    expect(json).toContain('"skeleton"')
    for (const file of ['tokens.json', 'build.mjs'])
      expect(read(file).toLowerCase(), file).not.toContain('ovation')
  })
})

describe('light theme keeps the look the app had before tokens (names and values)', () => {
  // 토큰 정본으로 옮기기 전 index.css `:root` 의 18개. 값은 옛 글자 그대로.
  // 예외 하나: --amber 는 #a86612 → #975c0f (옛 값은 amber-soft · code-bg 위에서 AA 4.5:1 미달 — contrast.test.ts)
  const LEGACY: Record<string, string> = {
    '--bg': '#f5f7f6',
    '--surface': '#ffffff',
    '--surface-muted': '#eef2f0',
    '--text': '#2a2d2b',
    '--text-muted': '#69706c',
    '--text-strong': '#111413',
    '--border': '#d8dfda',
    '--border-strong': '#b9c4bd',
    '--code-bg': '#e7ece9',
    '--teal': '#0f766e',
    '--teal-soft': '#dff5f0',
    '--amber': '#975c0f',
    '--amber-soft': '#fff0d5',
    '--red': '#b33b2e',
    '--red-soft': '#ffe2de',
    '--shadow': '0 18px 45px rgba(36, 47, 43, 0.08)',
    '--sans':
      "'Avenir Next', 'IBM Plex Sans KR', 'Noto Sans KR', ui-sans-serif, system-ui, sans-serif",
    '--mono': "'JetBrains Mono', 'SFMono-Regular', Consolas, ui-monospace, monospace",
  }
  const light = themeVars(out.css, 'light')

  it.each(Object.entries(LEGACY))('%s', (name, value) => {
    expect(expandVars(light, light.get(name) ?? `missing ${name}`)).toBe(value)
  })
})

describe('theme blocks in tokens.css', () => {
  const css = out.css

  it('light is :root, dark is [data-theme=dark], system dark is a media block that skips an explicit light', () => {
    expect(css).toMatch(/\n:root,\n\[data-theme='light'\] \{\n {2}color-scheme: light;/)
    expect(css).toContain("\n[data-theme='dark'] {")
    expect(css).toContain('@media (prefers-color-scheme: dark) {')
    expect(css).toContain(":root:not([data-theme='light']) {")
  })

  it('a theme applies to any element, not only <html> — a container can show light or dark side by side', () => {
    expect(css).not.toContain("html[data-theme='")
    const selectors = cssBlocks(css)
      .filter((block) => block.media === null)
      .map((block) => block.selector)
    expect(selectors).toContain(":root, [data-theme='light']")
    expect(selectors).toContain("[data-theme='dark']")
  })

  it('color-scheme follows the theme so native controls match', () => {
    expect(themeVars(css, 'light').get('color-scheme')).toBe('light')
    expect(themeVars(css, 'dark').get('color-scheme')).toBe('dark')
    expect(themeVars(css, 'dark', { system: true }).get('color-scheme')).toBe('dark')
  })

  it('system dark declares the same values as explicit dark', () => {
    const dark = themeVars(css, 'dark')
    const system = themeVars(css, 'dark', { system: true })
    expect([...system]).toEqual([...dark])
  })

  it('dark overrides semantic tokens only, never primitives', () => {
    const light = themeVars(css, 'light')
    const dark = themeVars(css, 'dark')
    for (const [name, value] of dark)
      if (name.startsWith('--p-')) expect(value, name).toBe(light.get(name))
  })

  it('dark is a greenish dark gray: not pure black and the card is lighter than the page', () => {
    const dark = themeVars(css, 'dark')
    const hex = (name: string) => expandVars(dark, dark.get(name)!)
    expect(hex('--bg')).not.toMatch(/^#0{6}$|^#000$/)
    const lum = (h: string) =>
      parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5), 16)
    expect(lum(hex('--surface'))).toBeGreaterThan(lum(hex('--bg')))
  })
})

describe('spacing, radius and type scales (primitive → semantic)', () => {
  const light = themeVars(out.css, 'light')
  const resolved = (name: string) => expandVars(light, light.get(name) ?? `missing ${name}`)
  const semantic = out.tokens.filter((t) => t.layer === 'semantic')
  const semanticNames = (group: string) =>
    semantic.filter((t) => t.group === `semantic.${group}`).map((t) => t.cssName)

  it('spacing is a 4px grid: semantic names reference the --p-space-* primitives', () => {
    expect(semanticNames('spacing')).toEqual([
      '--space-xs',
      '--space-sm',
      '--space-md',
      '--space-lg',
      '--space-xl',
      '--space-2xl',
      '--space-3xl',
    ])
    expect(
      ['--space-xs', '--space-sm', '--space-md', '--space-lg', '--space-xl'].map(resolved),
    ).toEqual(['4px', '8px', '12px', '16px', '20px'])
    expect(resolved('--space-3xl')).toBe('32px')
    expect(light.get('--space-md')).toBe('var(--p-space-3)')
  })

  it('radius has sm / md / lg and a pill that stays round on any size', () => {
    expect(semanticNames('radius')).toEqual([
      '--radius-sm',
      '--radius-md',
      '--radius-lg',
      '--radius-full',
    ])
    expect(['--radius-sm', '--radius-md', '--radius-lg'].map(resolved)).toEqual([
      '4px',
      '6px',
      '8px',
    ])
    expect(resolved('--radius-full')).toBe('9999px')
  })

  it('the type scale names roles (caption … title) and has line heights', () => {
    expect(semanticNames('type')).toEqual([
      '--font-size-caption',
      '--font-size-small',
      '--font-size-body',
      '--font-size-subheading',
      '--font-size-heading',
      '--font-size-title',
      '--line-height-tight',
      '--line-height-snug',
      '--line-height-normal',
    ])
    expect(resolved('--font-size-body')).toBe('15px')
    expect(resolved('--font-size-title')).toBe('28px')
    expect(resolved('--line-height-normal')).toBe('1.5')
  })

  it('themes do not touch them: dark declares none of these (they are theme-independent)', () => {
    const dark = themeVars(out.css, 'dark')
    for (const name of ['--space-md', '--radius-md', '--font-size-body']) {
      expect(light.get(name), name).toBeDefined()
      expect(dark.get(name), name).toBe(light.get(name))
    }
  })

  it('semantic layout tokens reference primitives, never raw lengths', () => {
    for (const t of semantic.filter((t) =>
      /^--(space|radius|font-size|line-height)-/.test(t.cssName),
    ))
      expect(t.raw, t.path).toMatch(/^\{[\w.-]+\}$/)
  })
})
