/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO, walk } from './support/loadWorkspaces'

/*
 * 스토리는 부품의 「보이는 모양 · 정본 사용법 · 실행되는 테스트」 한 곳이다 — 썩지 않게 여기서 묶는다.
 *  1. @skeleton/ui 가 export 하는 것마다 스토리 파일이 있고, play(상호작용 테스트)가 하나 이상 있다.
 *  2. 모든 스토리는 CSF3 + `satisfies Meta` + 제목 규칙(UI/ · Packages/ · Patterns/ · Design tokens/).
 *  3. Patterns 는 @skeleton/ui(와 react · storybook)만 import 하고 숨은 도우미 파일이 없다. 모두 에이전트 안내(CLAUDE.md)에 적혀 있다.
 *  4. docs/ui-catalog.md 의 표가 디스크의 스토리 파일과 어긋나지 않는다.
 */
const read = (path: string) => readFileSync(join(REPO, path), 'utf8')
const rel = (file: string) => relative(REPO, file).split('\\').join('/')

const allStories = [
  ...walk(join(REPO, 'packages')),
  ...(existsSync(join(REPO, 'apps/storybook')) ? walk(join(REPO, 'apps/storybook')) : []),
]
  .filter((file) => /\.stories\.tsx$/.test(file))
  .map(rel)
  .sort()

const hasPlay = (path: string) => /^\s*play\s*:/m.test(read(path))

/** `export { A, B } from './Dir/File'` 중 값(type 아님) 이름 → 그 소스 폴더 */
function uiValueExports() {
  const barrel = read('packages/ui/src/index.ts')
  const found: Array<{ name: string; dir: string }> = []
  for (const m of barrel.matchAll(/^export\s+\{([^}]+)\}\s+from\s+'\.\/([^/']+)\/[^']+'/gm))
    for (const name of m[1]
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean))
      found.push({ name, dir: m[2] })
  return found
}

describe('@skeleton/ui stories', () => {
  const exports = uiValueExports()

  it('reads the barrel (the scanner is not looking at an empty list)', () => {
    expect(exports.map((e) => e.name)).toEqual(expect.arrayContaining(['Button', 'Dialog', 'Tabs']))
  })

  it.each(exports.map((e) => [e.name, e.dir]))(
    '%s has a stories file next to its source with at least one play function',
    (_, dir) => {
      const stories = allStories.filter((file) => file.startsWith(`packages/ui/src/${dir}/`))
      expect(stories, `packages/ui/src/${dir}/*.stories.tsx`).not.toEqual([])
      expect(
        stories.some((file) => hasPlay(file)),
        `a play function in ${stories.join(', ')}`,
      ).toBe(true)
    },
  )
})

describe('every stories file', () => {
  it('exists (the scanner is not looking at an empty list)', () => {
    expect(allStories.length).toBeGreaterThan(20)
  })

  it.each(allStories.map((file) => [file]))(
    '%s is CSF3 with a typed meta, a title and a play',
    (file) => {
      const text = read(file)
      expect(text, 'satisfies Meta').toMatch(/satisfies\s+Meta\b/)
      expect(text, 'export default meta').toMatch(/export\s+default\s+meta/)
      expect(text, 'title').toMatch(/title:\s*'(UI|Packages|Patterns|Design tokens)\//)
      expect(hasPlay(file), 'play function').toBe(true)
    },
  )

  it('has unique titles', () => {
    const titles = allStories.map((file) => read(file).match(/title:\s*'([^']+)'/)?.[1])
    expect(new Set(titles).size).toBe(titles.length)
  })
})

describe('Patterns', () => {
  const patterns = allStories.filter((file) => file.startsWith('apps/storybook/src/patterns/'))
  const guide = read('CLAUDE.md')

  it('exist (list, form, detail, auth, settings)', () => {
    expect(patterns.length).toBeGreaterThanOrEqual(5)
  })

  it.each(patterns.map((file) => [file]))('%s is listed in the agent guide (CLAUDE.md)', (file) => {
    expect(guide).toContain(file)
  })

  it.each(patterns.map((file) => [file]))(
    '%s is copyable: it imports only @skeleton/ui, react and storybook (no hidden helpers)',
    (file) => {
      const specifiers = [...read(file).matchAll(/\bfrom\s+'([^']+)'/g)].map((m) => m[1])
      for (const specifier of specifiers)
        expect(specifier, `${file} imports ${specifier}`).toMatch(
          /^(@skeleton\/ui|react|storybook\/test|@storybook\/react-vite)$/,
        )
    },
  )

  it('keeps every pattern in its own folder with nothing but stories in it', () => {
    const dir = join(REPO, 'apps/storybook/src/patterns')
    expect(readdirSync(dir).filter((name) => !name.endsWith('.stories.tsx'))).toEqual([])
  })
})

describe('docs/ui-catalog.md', () => {
  const catalog = read('docs/ui-catalog.md')
  const listed = [...catalog.matchAll(/`((?:packages|apps)\/[^`\s]+\.stories\.tsx)`/g)]
    .map((m) => m[1])
    .sort()

  it('lists every stories file on disk exactly once', () => {
    expect(listed).toEqual(allStories)
  })

  it('gives each row a one-line when-to-use', () => {
    const rows = catalog.split('\n').filter((line) => line.includes('.stories.tsx'))
    for (const row of rows) {
      const cells = row
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean)
      expect(cells.length, row).toBeGreaterThanOrEqual(3)
      expect(basename(cells[1]), row).toMatch(/\.stories\.tsx/)
      expect(cells[2].length, row).toBeGreaterThan(10)
    }
  })
})
