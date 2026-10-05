/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { check } from '@skeleton/tokens/build'
import { describe, expect, it } from 'vitest'
import { loadWorkspaces, REPO } from './support/loadWorkspaces'

/*
 * 토큰 정본 → 생성물이 레포 전체에서 한 곳(packages/tokens)에만 있고, 앱이 그것을 먼저 불러오는지.
 * (정본 ↔ tokens.css 일치는 packages/tokens 의 테스트, 표 구역 ↔ docs 는 여기)
 */
const workspaces = loadWorkspaces()
const apps = workspaces.filter((w) => w.kind === 'app')
const read = (path: string) => readFileSync(join(REPO, path), 'utf8')

describe('docs/design-tokens.md', () => {
  it('table region equals what the generator makes (hand-written text outside it is untouched)', () => {
    expect(check({ docOut: '../../docs/design-tokens.md' }), 'drifted — run `pnpm tokens`').toEqual(
      [],
    )
  })

  it('does not leak a project name into the generator docs', () => {
    expect(read('docs/design-tokens.md').toLowerCase()).not.toContain('ovation')
  })
})

describe.each(apps.map((w) => [w.dir, w] as const))('%s entry wiring', (_, app) => {
  // 브라우저 진입점 — SPA 는 src/main.tsx, 서버 렌더 앱은 src/entry-client.tsx
  const main = app.files.find(
    (f) => f.path === 'src/main.tsx' || f.path === 'src/entry-client.tsx',
  )!.text

  it('main.tsx loads tokens.css, then base.css, before any app stylesheet', () => {
    const tokens = main.indexOf("'@skeleton/tokens/tokens.css'")
    const base = main.indexOf("'@skeleton/ui/base.css'")
    expect(tokens).toBeGreaterThanOrEqual(0)
    expect(base).toBeGreaterThan(tokens)
    const own = [...main.matchAll(/import '(\.\/[^']+\.css)'/g)].map((m) => main.indexOf(m[0]))
    for (const at of own) expect(at).toBeGreaterThan(base)
  })

  it('calls initTheme() before it renders (@skeleton/theme does nothing at import time)', () => {
    const init = main.search(/\binitTheme\(\)/)
    const render = main.search(/\b(?:createRoot|hydrateRoot)\(/)
    expect(main).toMatch(/import\s*\{[^}]*\binitTheme\b[^}]*\}\s*from\s*'@skeleton\/theme'/)
    expect(init).toBeGreaterThanOrEqual(0)
    expect(render).toBeGreaterThan(init)
  })

  it('index.html has no hand-copied theme script (the plugin injects it)', () => {
    const page = app.files.find((f) => f.path === 'index.html')!.text
    expect(page).not.toContain('localStorage')
  })
})

describe('no custom properties outside the generated tokens', () => {
  const css = workspaces.flatMap((ws) =>
    ws.files
      .filter((f) => f.path.endsWith('.css'))
      .map((f) => ({ file: `${ws.dir}/${f.path}`, text: f.text })),
  )

  it('no app or package stylesheet declares a --custom-property (tokens.json is the only place)', () => {
    const offenders = css
      .filter((f) => f.file !== 'packages/tokens/tokens.css')
      .filter(
        (f) =>
          (f.text.replace(/\/\*[\s\S]*?\*\//g, '').match(/(^|[;{\s])--[\w-]+\s*:/g) ?? []).length >
          0,
      )
    expect(offenders.map((f) => f.file)).toEqual([])
  })

  it('only packages/tokens/tokens.css is a generated stylesheet', () => {
    const generated = workspaces.flatMap((ws) =>
      ws.files.filter((f) => f.text.startsWith('/* GENERATED')).map((f) => `${ws.dir}/${f.path}`),
    )
    expect(generated).toEqual(['packages/tokens/tokens.css'])
  })
})
