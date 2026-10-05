/// <reference types="node" />
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  checkCatalog,
  checkCoverage,
  checkExports,
  checkGenerated,
  checkKeywords,
  checkNeeds,
  checkPaths,
  checkSchema,
  loadCatalog,
  loadSchema,
} from '../scripts/capabilities.d/lib.mjs'
import { renderCapabilitiesMd, renderLlmsTxt } from '../scripts/capabilities.d/render.mjs'
import { projectCatalog } from '../scripts/capabilities.d/project.mjs'
import type { Catalog } from '../scripts/capabilities.d/lib.mjs'
import { entry, fixtureCatalog, makeFixtureRepo, type Json } from './support/capabilitiesFixture'
import { REPO } from './support/loadWorkspaces'

/*
 * capabilities.json — 「이 스켈레톤에 무엇이 준비돼 있는가」를 LLM 이 읽는 단일 정본. 이 파일은 그 가드를 가드한다:
 * 가짜 작은 레포(support/capabilitiesFixture.ts)를 한 곳씩 망가뜨려 가드가 정말 잡는지, 그리고 진짜 레포가 가드를 통과하는지.
 * 새 패키지 · 앱을 더하고 카탈로그를 안 고치면 어느 가드가 무엇을 더하라고 말해야 하는지가 여기서 고정된다.
 */
const roots: string[] = []
const repo = () => {
  const root = makeFixtureRepo()
  roots.push(root)
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
const withEntries = (mutate: (list: Json[]) => Json[]): Catalog => {
  const catalog = fixtureCatalog()
  return { ...catalog, capabilities: mutate(catalog.capabilities as Json[]) }
}
const edit = (id: string, over: Json) =>
  withEntries((list) => list.map((e) => (e.id === id ? { ...e, ...over } : e)))

describe('schema (docs/capabilities.schema.json)', () => {
  const schema = loadSchema(REPO)
  it('accepts a complete catalog', () => {
    expect(checkSchema(fixtureCatalog(), schema)).toEqual([])
  })
  it('rejects an entry without keywords, naming the field', () => {
    const catalog = withEntries((list) =>
      list.map((e) => {
        const copy = { ...e }
        delete copy.keywords
        return copy
      }),
    )
    const problems = checkSchema(catalog, schema)
    expect(problems.join('\n')).toMatch(/capabilities\[0\].*keywords/)
  })
  it('rejects an unknown kind and lists the allowed ones', () => {
    const problems = checkSchema(edit('beta', { kind: 'widget' }), schema)
    expect(problems.join('\n')).toMatch(/kind.*package.*app.*pattern.*script/)
  })
  it('rejects a field the schema does not know (typos do not slip through)', () => {
    const problems = checkSchema(edit('beta', { keyword: { ko: [], en: [] } }), schema)
    expect(problems.join('\n')).toMatch(/keyword/)
  })
})

describe('coverage: every package and app has an entry, and every entry has a package or app', () => {
  it('passes on a complete catalog', () => {
    expect(checkCoverage(fixtureCatalog(), repo())).toEqual([])
  })
  it('a package without an entry fails and says exactly what to add', () => {
    const catalog = withEntries((list) => list.filter((e) => e.id !== 'beta'))
    const text = checkCoverage(catalog, repo()).join('\n')
    expect(text).toContain('packages/beta')
    expect(text).toContain('capabilities.json')
    expect(text).toContain('"id": "beta"')
    expect(text).toContain('"kind": "package"')
    expect(text).toContain('"package": "@skeleton/beta"')
    expect(text).toContain('"path": "packages/beta"')
    expect(text).toContain('pnpm capabilities')
  })
  it('an app without an entry fails the same way', () => {
    const catalog = withEntries((list) => list.filter((e) => e.id !== 'app-web'))
    const text = checkCoverage(catalog, repo()).join('\n')
    expect(text).toContain('apps/web')
    expect(text).toContain('"id": "app-web"')
    expect(text).toContain('"kind": "app"')
  })
  it('an entry whose package folder is gone fails and says to remove it', () => {
    const catalog = withEntries((list) => [
      ...list,
      entry({ id: 'ghost', kind: 'package', package: '@skeleton/ghost', path: 'packages/ghost' }),
    ])
    const text = checkCoverage(catalog, repo()).join('\n')
    expect(text).toMatch(/ghost.*packages\/ghost.*(does not exist|remove)/s)
  })
  it('an entry whose package name does not match package.json fails', () => {
    const text = checkCoverage(edit('beta', { package: '@skeleton/betta' }), repo()).join('\n')
    expect(text).toContain('@skeleton/betta')
    expect(text).toContain('@skeleton/beta')
  })
  it('ids are unique', () => {
    const catalog = withEntries((list) => [...list, { ...list[1] }])
    expect(checkCoverage(catalog, repo()).join('\n')).toMatch(/duplicate id.*beta/)
  })
})

describe('paths: every story, pattern, doc and file entry point exists', () => {
  it('passes on a complete catalog', () => {
    expect(checkPaths(fixtureCatalog(), repo())).toEqual([])
  })
  for (const field of ['stories', 'patterns', 'docs'] as const) {
    it(`a missing ${field} path fails and names the entry and the path`, () => {
      const text = checkPaths(
        edit('alpha', { [field]: [`packages/alpha/nope-${field}.md`] }),
        repo(),
      ).join('\n')
      expect(text).toContain('alpha')
      expect(text).toContain(`packages/alpha/nope-${field}.md`)
    })
  }
  it('an app entry point that is not a file fails', () => {
    const text = checkPaths(
      edit('app-web', { entryPoints: ['apps/web/src/gone.tsx'] }),
      repo(),
    ).join('\n')
    expect(text).toContain('apps/web/src/gone.tsx')
  })
  it('a path that escapes the repo fails', () => {
    const text = checkPaths(edit('alpha', { docs: ['../outside.md'] }), repo()).join('\n')
    expect(text).toContain('../outside.md')
  })
})

describe('exports: every listed entry point is exported by the package', () => {
  it('passes (named, type, inline and subpath exports)', () => {
    expect(checkExports(fixtureCatalog(), repo())).toEqual([])
  })
  it('a name the package does not export fails and names it with the barrel path', () => {
    const text = checkExports(
      edit('alpha', { entryPoints: ['makeAlpha', 'vanished'] }),
      repo(),
    ).join('\n')
    expect(text).toContain('vanished')
    expect(text).toContain('packages/alpha/src/index.ts')
  })
  it('a subpath name that the subpath file does not export fails', () => {
    const text = checkExports(
      edit('alpha', { entryPoints: ['@skeleton/alpha/vite#nothing'] }),
      repo(),
    ).join('\n')
    expect(text).toContain('nothing')
    expect(text).toContain('./vite')
  })
  it('a subpath the package.json does not declare fails', () => {
    const text = checkExports(
      edit('alpha', { entryPoints: ['@skeleton/alpha/zzz#x'] }),
      repo(),
    ).join('\n')
    expect(text).toContain('@skeleton/alpha/zzz')
  })
})

describe('needs: ids exist, and a package needs exactly the packages it declares as dependencies', () => {
  it('passes', () => {
    expect(checkNeeds(fixtureCatalog(), repo())).toEqual([])
  })
  it('an unknown id fails', () => {
    expect(
      checkNeeds(edit('alpha', { needs: ['beta', 'nonexistent'] }), repo()).join('\n'),
    ).toContain('nonexistent')
  })
  it('a missing dependency fails and says which one to add', () => {
    const text = checkNeeds(edit('alpha', { needs: [] }), repo()).join('\n')
    expect(text).toMatch(/alpha.*needs.*beta/s)
  })
})

describe('keywords: both languages, non-empty', () => {
  it('passes', () => {
    expect(checkKeywords(fixtureCatalog())).toEqual([])
  })
  it('empty Korean list fails', () => {
    expect(checkKeywords(edit('beta', { keywords: { ko: [], en: ['beta'] } })).join('\n')).toMatch(
      /beta.*keywords\.ko/,
    )
  })
  it('empty English list fails', () => {
    expect(checkKeywords(edit('beta', { keywords: { ko: ['베타'], en: [] } })).join('\n')).toMatch(
      /beta.*keywords\.en/,
    )
  })
  it('a Korean keyword without Hangul (or an English one with Hangul) fails — the languages are not swapped', () => {
    expect(
      checkKeywords(edit('beta', { keywords: { ko: ['beta'], en: ['beta'] } })).join('\n'),
    ).toContain('"beta"')
    expect(
      checkKeywords(edit('beta', { keywords: { ko: ['베타'], en: ['베타'] } })).join('\n'),
    ).toContain('"베타"')
  })
})

describe('generated docs: docs/capabilities.md and llms.txt are rendered from the catalog', () => {
  it('fail when the files are missing, with the command that writes them', () => {
    const problems = checkGenerated(fixtureCatalog(), repo()).join('\n')
    expect(problems).toContain('docs/capabilities.md')
    expect(problems).toContain('llms.txt')
    expect(problems).toContain('pnpm capabilities')
  })
  it('pass once rendered, fail again when the catalog changes', () => {
    const root = repo()
    const catalog = fixtureCatalog()
    writeFileSync(join(root, 'docs/capabilities.md'), renderCapabilitiesMd(catalog))
    writeFileSync(join(root, 'llms.txt'), renderLlmsTxt(catalog))
    expect(checkGenerated(catalog, root)).toEqual([])
    const changed = edit('beta', { summary: 'Beta changed its mind.' })
    expect(checkGenerated(changed, root).join('\n')).toContain('docs/capabilities.md')
  })
  it('the table lists every entry with its summary and keywords in both languages', () => {
    const md = renderCapabilitiesMd(fixtureCatalog())
    for (const text of [
      'alpha',
      'Alpha does things.',
      '알파',
      'beta',
      'app-web',
      'script-tool',
      '/api/v1/alpha',
    ])
      expect(md).toContain(text)
  })
  it('llms.txt points at the catalog, the docs and CLAUDE.md', () => {
    const txt = renderLlmsTxt(fixtureCatalog())
    for (const text of ['capabilities.json', 'docs/capabilities.md', 'CLAUDE.md'])
      expect(txt).toContain(text)
  })
})

describe('the catalog travels: a stamped project gets only what it selected, plus a pointer back', () => {
  const stamped = (keep: string[]) => {
    const root = repo()
    const catalog = fixtureCatalog()
    return projectCatalog(catalog, {
      root,
      projectName: 'shop',
      appFrom: 'web',
      appTo: 'shop',
      keepIds: keep,
    })
  }
  it('keeps only the selected entries and names what was left out', () => {
    const out = stamped(['beta', 'app-web']) as Json
    const ids = (out.capabilities as Json[]).map((e) => e.id)
    expect(ids).toEqual(['beta', 'app-shop'])
    expect(out.mode).toBe('project')
    expect((out.omitted as Json[]).map((e) => e.id).sort()).toEqual(['alpha'])
    expect(JSON.stringify(out.skeleton)).toContain('fixture-skeleton')
  })
  it('renames the app entry and its path', () => {
    const app = (stamped(['app-web']).capabilities as Json[])[0]
    expect(app.path).toBe('apps/shop')
    expect(app.package).toBe('shop')
  })
  it('drops file paths that did not travel (stories of a project without Storybook)', () => {
    const root = repo()
    rmSync(join(root, 'packages/alpha/src/Alpha.stories.tsx'))
    const out = projectCatalog(fixtureCatalog(), {
      root,
      projectName: 'shop',
      appFrom: 'web',
      appTo: 'shop',
      keepIds: ['alpha', 'beta'],
    }) as Json
    expect((out.capabilities as Json[])[0].stories).toEqual([])
  })
  it('renders a project-mode doc with the pointer and no decision table', () => {
    const out = stamped(['beta', 'app-web'])
    const md = renderCapabilitiesMd(out)
    expect(md).toContain('fixture-skeleton')
    expect(md).toContain('beta')
    expect(md).not.toContain('alpha-mod')
  })
})

describe('the real repo', () => {
  it('passes every guard (schema · coverage · paths · exports · needs · keywords · generated docs)', () => {
    expect(checkCatalog(REPO)).toEqual([])
  })
  it('has the catalog files', () => {
    expect(loadCatalog(REPO).capabilities.length).toBeGreaterThan(0)
  })
})
