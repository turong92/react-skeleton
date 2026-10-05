/// <reference types="node" />
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, describe, it } from 'vitest'
import { LAYOUT_EXEMPT } from './support/layoutExempt'
import { loadWorkspaces, REPO } from './support/loadWorkspaces'

/*
 * 이 스켈레톤 레포만의 사실 — 어떤 앱 · 패키지가 있는가. scripts/new-project.sh 가 새 프로젝트를 찍을 때 이 파일을 지운다
 * (새 프로젝트는 자기 앱 · 고른 패키지를 가지므로 이 목록이 맞지 않는다). 일반 규칙은 workspace.test.ts · usage.test.ts · contrast.test.ts.
 */
const workspaces = loadWorkspaces()
const css = workspaces.flatMap((ws) =>
  ws.files.filter((f) => f.path.endsWith('.css')).map((f) => ({ ws: ws.dir, file: f.path })),
)
const dirs = (kind: 'app' | 'package') =>
  workspaces
    .filter((w) => w.kind === kind)
    .map((w) => w.dir)
    .sort()

describe('the skeleton repo', () => {
  it('has the five apps and the fourteen packages', () => {
    expect(dirs('app')).toEqual([
      'apps/sample',
      'apps/starter',
      'apps/starter-ssr',
      'apps/storybook',
      'apps/workbench',
    ])
    expect(dirs('package')).toEqual([
      'packages/api-client',
      'packages/auth',
      'packages/board',
      'packages/captcha-turnstile',
      'packages/i18n',
      'packages/notifications',
      'packages/payment',
      'packages/realtime',
      'packages/seo',
      'packages/storage',
      'packages/theme',
      'packages/time',
      'packages/tokens',
      'packages/ui',
    ])
  })

  it('the starter is the app a project copies: no workbench code in it', () => {
    const starter = workspaces.find((w) => w.dir === 'apps/starter')!
    expect(JSON.stringify(starter.packageJson)).not.toContain('workbench')
    for (const file of starter.files) expect(file.text, file.path).not.toMatch(/workbench/i)
  })

  it('the sample (the reference product) is an app of its own: no workbench code, and its packages are the ones the stamp adds with --with-sample', () => {
    const sample = workspaces.find((w) => w.dir === 'apps/sample')!
    expect(JSON.stringify(sample.packageJson)).not.toContain('workbench')
    for (const file of sample.files) expect(file.text, file.path).not.toMatch(/workbench/i)
    const declared = Object.keys(sample.packageJson.dependencies ?? {}).filter((dep) =>
      dep.startsWith('@skeleton/'),
    )
    expect(declared.sort()).toEqual(
      expect.arrayContaining([
        '@skeleton/board',
        '@skeleton/notifications',
        '@skeleton/storage',
        '@skeleton/ui',
      ]),
    )
  })

  it('the SPA starter and the SSR starter need the same packages (new-project --ssr swaps one for the other)', () => {
    const declared = (dir: string) =>
      Object.keys(workspaces.find((w) => w.dir === dir)!.packageJson.dependencies ?? {})
        .filter((dep) => dep.startsWith('@skeleton/'))
        .sort()
    expect(declared('apps/starter-ssr')).toEqual(declared('apps/starter'))
  })

  it('every package that ships a component or a flow has stories next to it (the storybook is the reference)', () => {
    const withStories = workspaces
      .filter((w) => w.kind === 'package')
      .filter((w) => w.files.some((f) => f.path.endsWith('.stories.tsx')))
      .map((w) => w.dir)
      .sort()
    expect(withStories).toEqual([
      'packages/auth',
      'packages/board',
      'packages/captcha-turnstile',
      'packages/i18n',
      'packages/notifications',
      'packages/seo',
      'packages/storage',
      'packages/theme',
      'packages/time',
      'packages/ui',
    ])
  })

  it('the storybook app holds the config, the patterns and the tokens page — not the component stories', () => {
    const storybook = workspaces.find((w) => w.dir === 'apps/storybook')!
    const stories = storybook.files
      .filter((f) => f.path.endsWith('.stories.tsx'))
      .map((f) => f.path)
    expect(stories.sort()).toEqual([
      'src/patterns/DashboardPage.stories.tsx',
      'src/patterns/DetailPage.stories.tsx',
      'src/patterns/ForbiddenPage.stories.tsx',
      'src/patterns/FormPage.stories.tsx',
      'src/patterns/ListPage.stories.tsx',
      'src/patterns/LoginPage.stories.tsx',
      'src/patterns/SettingsPage.stories.tsx',
      'src/tokens/Tokens.stories.tsx',
    ])
  })

  it('the scanners look at the apps and at the packages that draw UI', () => {
    const cssDirs = new Set(css.map((f) => f.ws))
    expect([...cssDirs]).toEqual(
      expect.arrayContaining([
        'apps/workbench',
        'apps/starter',
        'apps/starter-ssr',
        'apps/storybook',
        'apps/sample',
        'packages/ui',
        'packages/theme',
        'packages/notifications',
        'packages/board',
      ]),
    )
  })

  it('the only app exempt from the layout-token check is the workbench, and the starter and the packages are not exempt', () => {
    expect(LAYOUT_EXEMPT).toEqual(['apps/workbench'])
  })

  it('carries the one-command project stamp and its test', () => {
    for (const path of [
      'scripts/new-project.sh',
      'scripts/test-new-project.sh',
      '.github/workflows/new-project.yml',
    ])
      expect(existsSync(join(REPO, path)), path).toBe(true)
  })
})
