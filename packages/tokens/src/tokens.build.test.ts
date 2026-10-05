/// <reference types="node" />
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { build, check, main, resolveTokens } from '../build.mjs'

/*
 * 생성기(design/tokens/build.mjs) 동작 — 작은 가짜 정본으로 잰다. 실제 tokens.json 과 생성물의 일치는 tokens.test.ts.
 */
const DOC = 'docs/design-tokens.md'
const BUILD = fileURLToPath(new URL('../build.mjs', import.meta.url))

const fixture = () => ({
  color: {
    $type: 'color',
    neutral: {
      '0': { $value: '#ffffff', $description: 'white' },
      '900': { $value: '#111111', $description: 'near black' },
    },
    brand: { '500': { $value: '#0f766e' }, '300': { $value: '#5cd6c6' } },
  },
  font: { family: { sans: { $value: 'system-ui, sans-serif', $type: 'fontFamily' } } },
  semantic: {
    surface: {
      $extensions: { skeleton: { title: 'Surface' } },
      $description: 'surface note',
      bg: {
        $value: '{color.neutral.0}',
        $description: 'page',
        $extensions: { skeleton: { dark: '{color.neutral.900}' } },
      },
      card: { $value: '{semantic.surface.bg}', $description: 'card follows bg' },
    },
    accent: {
      $extensions: { skeleton: { title: 'Accent' } },
      brand: {
        $value: '{color.brand.500}',
        $extensions: { skeleton: { dark: '{color.brand.300}' } },
      },
    },
    font: {
      $extensions: { skeleton: { title: 'Font' } },
      sans: { $value: '{font.family.sans}' },
    },
  },
})

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function sandbox(
  json: unknown = fixture(),
  doc = 'intro\n<!-- tokens:start -->\nold\n<!-- tokens:end -->\noutro\n',
) {
  const root = mkdtempSync(join(tmpdir(), 'skeleton-tokens-'))
  roots.push(root)
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  put('tokens.json', JSON.stringify(json))
  put('docs/design-tokens.md', doc)
  return { root, read: (path: string) => readFileSync(join(root, path), 'utf8'), put }
}

const quiet = () => {
  const lines: string[] = []
  return { lines, log: (l: string) => lines.push(l), error: (l: string) => lines.push(l) }
}

describe('resolveTokens', () => {
  it('names layers and css variables: primitive --p-*, semantic --<last segment>', () => {
    const tokens = resolveTokens(fixture())
    const by = Object.fromEntries(tokens.map((t) => [t.path, t]))
    expect(by['color.neutral.0']).toMatchObject({ layer: 'primitive', cssName: '--p-neutral-0' })
    expect(by['font.family.sans'].cssName).toBe('--p-font-family-sans')
    expect(by['semantic.surface.bg']).toMatchObject({
      layer: 'semantic',
      cssName: '--bg',
      value: 'var(--p-neutral-0)',
      resolved: '#ffffff',
    })
  })

  it('resolves references through other semantic tokens, per theme', () => {
    const tokens = resolveTokens(fixture())
    const card = tokens.find((t) => t.cssName === '--card')!
    expect(card.resolved).toBe('#ffffff')
    expect(card.byTheme.dark).toMatchObject({ raw: null, value: null, resolved: '#111111' })
    const bg = tokens.find((t) => t.cssName === '--bg')!
    expect(bg.byTheme.dark).toMatchObject({ value: 'var(--p-neutral-900)', resolved: '#111111' })
  })

  it('defaults to light + dark with dark following the OS', () => {
    const tokens = resolveTokens(fixture())
    expect(tokens.themes).toEqual([
      { name: 'light', title: 'light', colorScheme: 'light', system: false },
      { name: 'dark', title: 'dark', colorScheme: 'dark', system: true },
    ])
  })

  it('reads the theme list from $extensions.skeleton.themes', () => {
    const json = {
      ...fixture(),
      $extensions: {
        skeleton: {
          themes: [
            { name: 'paper', title: 'Paper', colorScheme: 'light' },
            { name: 'ink', title: 'Ink', colorScheme: 'dark', system: true },
          ],
        },
      },
    }
    const dark = JSON.parse(JSON.stringify(json))
    dark.semantic.surface.bg.$extensions.skeleton = { ink: '{color.neutral.900}' }
    dark.semantic.accent.brand.$extensions.skeleton = { ink: '{color.brand.300}' }
    const tokens = resolveTokens(dark)
    expect(tokens.themes.map((t) => t.name)).toEqual(['paper', 'ink'])
    expect(tokens.find((t) => t.cssName === '--bg')!.byTheme.ink.resolved).toBe('#111111')
  })

  it('throws on a missing reference', () => {
    const json = fixture()
    json.semantic.surface.card.$value = '{color.nope}'
    expect(() => resolveTokens(json)).toThrow(/color\.nope/)
  })

  it('throws on a reference cycle', () => {
    const json = fixture()
    json.semantic.surface.bg.$value = '{semantic.surface.card}'
    delete (json.semantic.surface.bg as Record<string, unknown>).$extensions
    expect(() => resolveTokens(json)).toThrow(/cycle/)
  })

  it('throws on a theme value for an unknown theme', () => {
    const json = fixture()
    json.semantic.surface.bg.$extensions.skeleton = { sepia: '{color.neutral.0}' } as never
    expect(() => resolveTokens(json)).toThrow(/sepia/)
  })

  it('throws when a primitive carries a theme value', () => {
    const json = fixture() as ReturnType<typeof fixture> & Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    json.color.neutral['0'] = {
      $value: '#fff',
      $extensions: { skeleton: { dark: '#000' } },
    } as never
    expect(() => resolveTokens(json)).toThrow(/semantic/)
  })

  it('throws on a css name collision', () => {
    const json = fixture()
    ;(json.semantic.accent as Record<string, unknown>).bg = { $value: '{color.brand.500}' }
    expect(() => resolveTokens(json)).toThrow(/--bg/)
  })

  it('rejects theme names that are invalid, duplicated, or "system"', () => {
    const withThemes = (themes: unknown) => ({
      ...fixture(),
      $extensions: { skeleton: { themes } },
    })
    const base = { name: 'light', colorScheme: 'light' }
    expect(() => resolveTokens(withThemes([{ ...base, name: 'Light' }]))).toThrow()
    expect(() => resolveTokens(withThemes([{ ...base, name: 'system' }]))).toThrow(/system/)
    expect(() => resolveTokens(withThemes([base, base]))).toThrow(/light/)
    expect(() => resolveTokens(withThemes([{ ...base, colorScheme: 'sepia' }]))).toThrow(
      /colorScheme/,
    )
  })
})

describe('build', () => {
  it('writes tokens.css with primitive, light semantic, dark and system blocks', () => {
    const { root, read } = sandbox()
    build({ root, docOut: DOC })
    const css = read('tokens.css')
    expect(css).toContain('GENERATED')
    expect(css).toContain('--p-neutral-0: #ffffff;')
    expect(css).toMatch(/:root \{[^}]*color-scheme: light;[^}]*--bg: var\(--p-neutral-0\);/s)
    expect(css).toMatch(
      /html\[data-theme='dark'\] \{[^}]*color-scheme: dark;[^}]*--bg: var\(--p-neutral-900\);/s,
    )
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain(":root:not([data-theme='light'])")
    // --card has no dark value: it follows --bg through var()
    expect(css).not.toMatch(/html\[data-theme='dark'\] \{[^}]*--card/s)
  })

  it('system block repeats the dark declarations', () => {
    const { root, read } = sandbox()
    build({ root, docOut: DOC })
    const css = read('tokens.css')
    const dark = /html\[data-theme='dark'\] \{([^}]*)\}/s
      .exec(css)![1]
      .trim()
      .replace(/^ {2}/gm, '')
    const system = /@media \(prefers-color-scheme: dark\) \{\s*:root[^{]*\{([^}]*)\}/s.exec(css)![1]
    expect(system.trim().replace(/^ {4}/gm, '')).toBe(dark)
  })

  it('replaces only the table region of the doc, keeping hand-written text', () => {
    const { root, read } = sandbox()
    build({ root, docOut: DOC })
    const doc = read('docs/design-tokens.md')
    expect(doc.startsWith('intro\n<!-- tokens:start -->')).toBe(true)
    expect(doc.endsWith('<!-- tokens:end -->\noutro\n')).toBe(true)
    expect(doc).toContain('### Surface')
    expect(doc).toContain('| `--bg` | `#ffffff` | `#111111` |')
    expect(doc).toContain('| `--card` | `#ffffff` | `#111111` |') // follows --bg into dark
    expect(doc).toContain('| `--sans` | `system-ui, sans-serif` | = |')
    expect(doc).not.toContain('old')
  })

  it('does not write with write:false', () => {
    const { root, read } = sandbox()
    const out = build({ root, docOut: DOC, write: false })
    expect(out.css).toContain('--bg')
    expect(read('docs/design-tokens.md')).toContain('old')
  })

  it('throws when the doc has no table markers or does not exist', () => {
    const { root } = sandbox(fixture(), 'no markers')
    expect(() => build({ root, docOut: DOC })).toThrow(/tokens:start/)
    const second = sandbox()
    rmSync(join(second.root, 'docs/design-tokens.md'))
    expect(() => build({ root: second.root, docOut: DOC })).toThrow(/design-tokens\.md/)
  })
})

describe('check / main --check', () => {
  it('is clean after build, reports a hand-edited generated file, and does not touch it', () => {
    const { root, read } = sandbox()
    expect(main(['--doc', DOC], { root, ...quiet() })).toBe(0)
    expect(main(['--check', '--doc', DOC], { root, ...quiet() })).toBe(0)
    const edited = read('tokens.css').replace('--bg: var(--p-neutral-0);', '--bg: #000;')
    writeFileSync(join(root, 'tokens.css'), edited)
    const out = quiet()
    expect(main(['--check', '--doc', DOC], { root, ...out })).toBe(1)
    expect(out.lines.join('\n')).toContain('tokens.css')
    expect(out.lines.join('\n')).toContain('pnpm tokens')
    expect(read('tokens.css')).toBe(edited)
  })

  it('treats a missing generated file as drift instead of crashing', () => {
    const { root } = sandbox()
    main(['--doc', DOC], { root, ...quiet() })
    rmSync(join(root, 'tokens.css'))
    expect(check({ root, docOut: DOC })).toEqual(['tokens.css (missing)'])
    const out = quiet()
    expect(main(['--check', '--doc', DOC], { root, ...out })).toBe(1)
  })

  it('reports a doc table edited by hand', () => {
    const { root, read } = sandbox()
    main(['--doc', DOC], { root, ...quiet() })
    writeFileSync(
      join(root, 'docs/design-tokens.md'),
      read('docs/design-tokens.md').replace('`#111111`', '`#222222`'),
    )
    expect(check({ root, docOut: DOC })).toEqual(['docs/design-tokens.md'])
  })

  it('unknown flag prints usage and exits 2 without writing anything', () => {
    const { root, read } = sandbox()
    writeFileSync(join(root, 'tokens.css'), 'stale')
    const out = quiet()
    expect(main(['--chek'], { root, ...out })).toBe(2)
    expect(out.lines.join('\n')).toMatch(/usage/i)
    expect(read('tokens.css')).toBe('stale')
    expect(read('docs/design-tokens.md')).toContain('old')
  })

  it('--help prints usage and exits 0', () => {
    const out = quiet()
    expect(main(['--help'], { root: sandbox().root, ...out })).toBe(0)
    expect(out.lines.join('\n')).toMatch(/usage/i)
  })

  it('the real command line exits 2 for an unknown flag', () => {
    const result = spawnSync(process.execPath, [BUILD, '--nope'], { encoding: 'utf8' })
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/usage/i)
  })
})

describe('output paths are options', () => {
  it('without docOut it writes only the css and leaves docs alone', () => {
    const { root, read } = sandbox()
    const out = build({ root })
    expect(out.doc).toBeNull()
    expect(read('tokens.css')).toBe(out.css)
    expect(read(DOC)).toContain('old')
    expect(check({ root })).toEqual([])
  })

  it('honours source / cssOut / docOut relative to root, creating missing folders', () => {
    const { root, read, put } = sandbox()
    put('brand/colors.json', JSON.stringify(fixture()))
    put('site/guide.md', 'a\n<!-- tokens:start -->\nx\n<!-- tokens:end -->\nb\n')
    const paths = {
      source: 'brand/colors.json',
      cssOut: 'public/theme/tokens.css',
      docOut: 'site/guide.md',
    }
    const out = build({ root, ...paths })
    expect(read('public/theme/tokens.css')).toBe(out.css)
    expect(read('site/guide.md')).toBe(out.doc)
    expect(check({ root, ...paths })).toEqual([])
  })

  it('the command line takes --source / --css / --doc', () => {
    const { root, read, put } = sandbox()
    put('brand/colors.json', JSON.stringify(fixture()))
    const argv = ['--source', 'brand/colors.json', '--css', 'out/t.css', '--doc', DOC]
    expect(main(argv, { root, ...quiet() })).toBe(0)
    expect(read('out/t.css')).toContain('--p-neutral-0: #ffffff;')
    expect(main(['--check', ...argv], { root, ...quiet() })).toBe(0)
    writeFileSync(join(root, 'out/t.css'), 'stale')
    expect(main(['--check', ...argv], { root, ...quiet() })).toBe(1)
  })

  it('a flag that needs a value but gets none is an unknown-argument error (exit 2)', () => {
    const out = quiet()
    expect(main(['--css'], { root: sandbox().root, ...out })).toBe(2)
    expect(out.lines.join('\n')).toMatch(/usage/i)
  })
})
