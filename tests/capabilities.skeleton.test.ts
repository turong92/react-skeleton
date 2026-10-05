/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCatalog } from '../scripts/capabilities.d/lib.mjs'
import { fragmentFor } from '../scripts/capabilities.d/fragment.mjs'
import {
  checkDecisions,
  checkKotlinNames,
  checkRecipe,
  checkStampFlags,
  planPackages,
  recipeCommands,
} from '../scripts/capabilities.d/stampCheck.mjs'
import type { Json } from './support/capabilitiesFixture'
import { REPO } from './support/loadWorkspaces'

/*
 * 이 스켈레톤 레포만의 사실 — 카탈로그의 stampFlag 가 scripts/new-project.sh 가 실제로 하는 일과 같은가, 결정표 · 레시피의 명령이
 * 카탈로그에서 계산한 것과 같은가. scripts/new-project.sh 가 새 프로젝트를 찍을 때 이 파일을 지운다(스크립트가 없으니까).
 * 일반 가드(스키마 · 경로 · export · 키워드 · 생성 문서)는 capabilities.test.ts.
 */
type Catalog = { capabilities: Json[]; decisions: Json[]; examples: Json[] } & Json
const real = () => loadCatalog(REPO) as unknown as Catalog
const mutate = (id: string, over: Json): Catalog => {
  const c = real()
  return { ...c, capabilities: c.capabilities.map((e) => (e.id === id ? { ...e, ...over } : e)) }
}
const flagOf = (over: Json) => ({
  flag: null,
  included: 'flag',
  autoIncludes: [],
  alsoVia: [],
  optOut: null,
  ...over,
})

describe('stampFlag: what the catalog says new-project.sh does is what it does', () => {
  it('holds for every entry of the real catalog', () => {
    expect(checkStampFlags(real(), REPO)).toEqual([])
  })
  it('a package name new-project.sh does not know fails and says so', () => {
    const text = checkStampFlags(
      mutate('board', { stampFlag: flagOf({ flag: '--packages nope' }) }),
      REPO,
    ).join('\n')
    expect(text).toMatch(/board.*nope/s)
  })
  it('an option new-project.sh does not accept fails and names it', () => {
    const text = checkStampFlags(
      mutate('board', { stampFlag: flagOf({ flag: '--bogus' }) }),
      REPO,
    ).join('\n')
    expect(text).toContain('--bogus')
  })
  it('wrong autoIncludes fails and prints what the closure really is', () => {
    const text = checkStampFlags(
      mutate('board', { stampFlag: flagOf({ flag: '--packages board', autoIncludes: [] }) }),
      REPO,
    ).join('\n')
    expect(text).toMatch(/board.*autoIncludes.*api-client.*time.*ui/s)
  })
  it('wrong alsoVia fails and prints which flags really bring the package', () => {
    const text = checkStampFlags(
      mutate('seo', { stampFlag: flagOf({ flag: '--packages seo', alsoVia: [] }) }),
      REPO,
    ).join('\n')
    expect(text).toMatch(/seo.*alsoVia.*--ssr/s)
  })
  it('a package claimed to be always included but not in the default stamp fails', () => {
    const text = checkStampFlags(
      mutate('board', { stampFlag: { flag: null, included: 'always' } }),
      REPO,
    ).join('\n')
    expect(text).toMatch(/board.*always/s)
  })
  it('planPackages is the stamp plan (the ground truth the guard uses)', () => {
    expect(planPackages(REPO, { requested: ['board'] })).toEqual(
      expect.arrayContaining(['board', 'ui', 'api-client', 'time']),
    )
    expect(planPackages(REPO, {})).not.toContain('board')
  })
})

describe('the decision table is computed from the catalog and every row is a real stamp', () => {
  it('passes on the real catalog', () => {
    expect(checkDecisions(real(), REPO)).toEqual([])
  })
  it('an unknown capability id in a row fails', () => {
    const c = real()
    const bad = {
      ...c,
      decisions: [...c.decisions, { need: 'x', capabilities: ['nonexistent'], byHand: 'y' }],
    }
    expect(checkDecisions(bad, REPO).join('\n')).toContain('nonexistent')
  })
  it('every capability of the catalog is reachable from at least one decision row or example', () => {
    const c = real()
    const used = new Set([...c.decisions, ...c.examples].flatMap((d) => d.capabilities as string[]))
    const missing = c.capabilities
      .filter((e) => e.kind === 'package' && !used.has(e.id as string))
      .map((e) => e.id)
    expect(missing, `add a decision row for: ${missing.join(', ')}`).toEqual([])
  })
})

describe('docs/new-project-recipe.md cannot rot', () => {
  it('every example command equals what the catalog computes', () => {
    expect(checkRecipe(real(), REPO)).toEqual([])
  })
  it('a drifted command fails and prints the expected one', () => {
    const c = real()
    const drifted = {
      ...c,
      examples: c.examples.map((e, i) =>
        i === 0 ? { ...e, capabilities: [...(e.capabilities as string[]), 'payment'] } : e,
      ),
    }
    const text = checkRecipe(drifted, REPO).join('\n')
    expect(text).toContain('payment')
    expect(text).toContain('scripts/new-project.sh')
  })
  it('has three worked examples and extracts their react commands for the --full stamp test', () => {
    const commands = recipeCommands(REPO)
    expect(commands.length).toBeGreaterThanOrEqual(3)
    for (const c of commands) expect(c.reactArgs.length, c.id).toBeGreaterThan(0)
  })
  it('every repo path the recipe mentions exists', () => {
    const md = readFileSync(join(REPO, 'docs/new-project-recipe.md'), 'utf8')
    const paths = [...md.matchAll(/`((?:apps|packages|docs|scripts|tests)\/[\w./@-]+)`/g)]
      .map((m) => m[1])
      .filter((p) => !p.includes('<'))
    expect(paths.length).toBeGreaterThan(5)
    for (const p of paths) expect(existsSync(join(REPO, p)), p).toBe(true)
  })
  it('fragmentFor merges --packages and keeps other flags', () => {
    const f = fragmentFor(real(), ['board', 'i18n'], ['--with-sample'])
    expect(f.react).toBe('--packages board,i18n --with-sample')
  })
})

describe('llms.txt answers the owners words without opening anything else', () => {
  const llms = readFileSync(join(REPO, 'llms.txt'), 'utf8')
  const OWNER_WORDS = [
    '로그인',
    '소셜 로그인',
    '게시판',
    '댓글',
    '공감',
    '알림',
    '다국어',
    '랜딩',
    '약관',
    '결제',
    '파일 업로드',
    '캡차',
    '다크 모드',
    '요금제',
    '검색 노출',
  ]
  it.each(OWNER_WORDS)('mentions "%s"', (word) => {
    expect(
      llms,
      `add "${word}" to the keywords (or summary) of the entry that provides it`,
    ).toContain(word)
  })
  it('gives a pattern line the packages of everything it needs (live-notifications also needs realtime)', () => {
    const line = llms.split('\n').find((l) => l.startsWith('- live-notifications:')) ?? ''
    expect(line).toContain('--packages notifications,realtime')
    expect(line).toContain('kotlin')
  })
  it('states both new-project.sh interfaces and how to combine the fragments', () => {
    expect(llms).toContain('<root-package>')
    expect(llms).toContain('--packages')
    expect(llms).toContain('docs/new-project-recipe.md')
  })
})

describe('the backend side of the catalog names real kotlin-skeleton modules (only when the sibling repo is checked out)', () => {
  const sibling = join(REPO, '..', 'kotlin-skeleton', 'docs', 'modules', 'README.md')
  it.skipIf(!existsSync(sibling))(
    'every module in backend.* is in kotlin-skeleton docs/modules/README.md',
    () => {
      expect(checkKotlinNames(real(), sibling)).toEqual([])
    },
  )
})
