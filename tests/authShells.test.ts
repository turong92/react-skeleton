/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO } from './support/loadWorkspaces'

/*
 * 인증 보안 배선의 가드 — 코드가 말하는 것과 문서가 말하는 것이 같고, 모든 앱 껍데기가 일회용 토큰이 새지 않게 막는다.
 * 찍힌 프로젝트는 있는 앱만 본다(없는 앱은 건너뛴다).
 */
const read = (path: string) => readFileSync(join(REPO, path), 'utf8')
const allApps = readdirSync(join(REPO, 'apps'))
// 인증을 가진 앱(스타터 · 샘플, 찍힌 프로젝트의 앱)만 — 스토리집 · 워크벤치는 인증 저장소가 없다
const apps = allApps.filter((app) => existsSync(join(REPO, 'apps', app, 'src/auth/storage.ts')))
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('I6 — the documented default token storage is the real one (localStorage, shared by tabs)', () => {
  it.each(apps)('%s: browserTokenStorage() returns window.localStorage', (app) => {
    const code = stripComments(read(`apps/${app}/src/auth/storage.ts`))
    expect(code).toContain('window.localStorage')
    expect(code).not.toContain('sessionStorage')
  })

  it.each(apps)('%s: the token stores listen to other tabs (crossTab) — a localStorage default only works with it', (app) => {
    const code = read(`apps/${app}/src/auth/${existsSync(join(REPO, `apps/${app}/src/auth/createAuth.ts`)) ? 'createAuth.ts' : 'tokenStore.ts'}`)
    expect(code).toContain('crossTab: true')
  })

  it('the docs name localStorage as the default and do not claim sessionStorage holds the tokens', () => {
    const docs = [
      'packages/auth/README.md',
      ...apps.flatMap((app) => [
        `apps/${app}/.env.example`,
        `apps/${app}/src/auth/authConfig.ts`,
        `apps/${app}/README.md`,
      ]),
    ].filter((path) => existsSync(join(REPO, path)))
    const text = docs.map(read).join('\n')
    expect(text).toMatch(/localStorage/)
    // 「토큰은 sessionStorage 에」 · `createTokenStore({ storage: window.sessionStorage })` 같은 기본값 주장
    expect(text).not.toMatch(/토큰은 `sessionStorage`/)
    expect(text).not.toMatch(/createTokenStore\(\{ storage: window\.sessionStorage/)
    expect(text).not.toMatch(/기본은 이 탭이 닫히면 사라지는 sessionStorage/)
  })
})

describe('M1 — every app shell tells the browser not to send a Referer (the mailed ?token= must not leak)', () => {
  const shells = allApps.filter(
    (app) => app !== 'storybook' && existsSync(join(REPO, 'apps', app, 'index.html')),
  )
  it.each(shells)('%s/index.html has <meta name="referrer" content="no-referrer">', (app) => {
    expect(read(`apps/${app}/index.html`)).toMatch(
      /<meta\s+name="referrer"\s+content="no-referrer"\s*\/?>/,
    )
  })
})

describe('M10 — each app names its own auth namespace', () => {
  it('no two apps share one, and none keeps the package default', () => {
    const found = apps.map((app) => {
      const match = /AUTH_NAMESPACE = '([^']+)'/.exec(read(`apps/${app}/src/auth/authConfig.ts`))
      expect(match, `${app}/src/auth/authConfig.ts needs AUTH_NAMESPACE`).not.toBeNull()
      return match![1]
    })
    expect(new Set(found).size).toBe(found.length)
    expect(found).not.toContain('skeleton')
  })
})
