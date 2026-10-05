/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ComponentType, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { REPO } from './support/loadWorkspaces'
import {
  BROWSER_ONLY,
  COMPONENT_PROPS,
  HOOK_ARGS,
  fakeSession,
  type FixtureContext,
} from './support/ssrFixtures'

/*
 * SSR 안전 — 모든 패키지가 브라우저 전역(window · document · localStorage …)이 없는 Node 에서
 *   1) 불러와지고(import 시점에 아무것도 읽거나 쓰지 않고),
 *   2) export 한 모든 컴포넌트 · 훅이 서버에서 그려진다(renderToString, 경고 없이).
 * 목록은 각 패키지의 `exports` 에서 만든다 — 새 export 가 생기면 tests/support/ssrFixtures.ts 에 한 줄이 없는 한 이 테스트가 실패한다.
 * 브라우저 API 는 effect · 이벤트 핸들러 안에서만 쓴다. 일부러 브라우저 전용인 export 는 BROWSER_ONLY 에 이유와 함께 적는다.
 */
type Mod = Record<string, unknown>
type Entry = { pkg: string; dir: string; subpath: string; file: string; specifier: string }

/** Node 21+ 는 `navigator` 를 가진다 — 서버에 없는 것만 「없어야 한다」로 검사하고, 가짜로 바꿔 접근을 기록할 때는 `navigator` 도 넣는다 */
const ABSENT_IN_NODE = ['window', 'document', 'localStorage', 'sessionStorage'] as const
const BROWSER_GLOBALS = [...ABSENT_IN_NODE, 'navigator'] as const

/** `packages/*` 의 `exports` 중 코드(ts · tsx · js · mjs)인 것 — css · json 은 값을 import 하지 않는다 */
function packageEntries(): Entry[] {
  const entries: Entry[] = []
  for (const dir of readdirSync(join(REPO, 'packages')).sort()) {
    const manifestPath = join(REPO, 'packages', dir, 'package.json')
    if (!existsSync(manifestPath)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name: string
      exports: Record<string, string | { default?: string }>
    }
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      const file = typeof target === 'string' ? target : target.default
      if (!file || !/\.[cm]?[jt]sx?$/.test(file)) continue
      entries.push({
        pkg: manifest.name,
        dir,
        subpath,
        file: join(REPO, 'packages', dir, file),
        specifier: `${manifest.name}${subpath === '.' ? '' : subpath.slice(1)}`,
      })
    }
  }
  return entries
}

const load = (entry: Entry): Promise<Mod> => import(/* @vite-ignore */ entry.file)
const entries = packageEntries()
const barrels = entries.filter((entry) => entry.subpath === '.')

/** 접근을 기록하는 가짜 전역 — 이름만 있고 무엇이든 건드리면 기록된다 */
function recordingGlobals(touched: string[]) {
  for (const name of BROWSER_GLOBALS)
    vi.stubGlobal(
      name,
      new Proxy(
        {},
        {
          get(_, key) {
            touched.push(`${name}.${String(key)}`)
            return undefined
          },
          set(_, key) {
            touched.push(`${name}.${String(key)} = …`)
            return true
          },
        },
      ),
    )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the scanner looks at real packages in a plain Node environment', () => {
  it('has no browser globals and finds the package entries', () => {
    for (const name of ABSENT_IN_NODE)
      expect(typeof (globalThis as Mod)[name], name).toBe('undefined')
    expect(barrels.length).toBeGreaterThanOrEqual(1)
    expect(barrels.map((entry) => entry.dir)).toContain('ui')
  })
})

describe('importing every package entry', () => {
  it.each(entries.map((entry) => [entry.specifier, entry] as const))(
    '%s loads in plain Node (no window · document · localStorage)',
    async (_, entry) => {
      await expect(load(entry)).resolves.toBeDefined()
    },
  )

  it('touches no browser global at import time, even when one exists (calls like initTheme() are explicit)', async () => {
    const touched: string[] = []
    vi.resetModules()
    recordingGlobals(touched)
    for (const entry of entries) await load(entry)
    expect(touched).toEqual([])
  })
})

describe('server-rendering every exported component and hook', () => {
  const modules = new Map<string, Mod>()
  const ctx: FixtureContext = {
    mod(pkg) {
      const found = modules.get(pkg)
      if (!found) throw new Error(`${pkg} is not in this workspace`)
      return found
    },
  }
  beforeAll(async () => {
    for (const entry of barrels) modules.set(entry.dir, await load(entry))
  })

  const isComponentExport = (name: string, value: unknown) => {
    if (!/^[A-Z]/.test(name)) return false
    if (typeof value === 'function') {
      const proto = (value as { prototype?: object }).prototype
      return !(proto instanceof Error)
    }
    return typeof value === 'object' && value !== null && '$$typeof' in value
  }
  const isHookExport = (name: string, value: unknown) =>
    typeof value === 'function' && /^use[A-Z]/.test(name)

  const discover = async (kind: 'component' | 'hook') => {
    const found: string[] = []
    for (const entry of barrels)
      for (const [name, value] of Object.entries(await load(entry)))
        if (kind === 'component' ? isComponentExport(name, value) : isHookExport(name, value))
          found.push(`${entry.dir}#${name}`)
    return found.sort()
  }

  function page(children: ReactNode) {
    const auth = ctx.mod('auth')
    return createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(
        MemoryRouter,
        null,
        createElement(auth.AuthProvider as ComponentType<Record<string, unknown>>, {
          session: fakeSession(ctx),
          children,
        }),
      ),
    )
  }

  /** 렌더하고 — 던지지 않고, React 가 경고(console.error)도 내지 않아야 한다 */
  function renderClean(tree: ReactNode): string {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const html = renderToString(tree)
    expect(errors.mock.calls.map((call) => call.map(String).join(' '))).toEqual([])
    return html
  }

  const split = (keys: string[]) => ({
    skip: keys.filter((key) => key in BROWSER_ONLY),
    render: keys.filter((key) => !(key in BROWSER_ONLY)),
  })

  it('finds components and hooks to check (the scanner is not looking at an empty list)', async () => {
    expect(await discover('component')).toEqual(
      expect.arrayContaining(['ui#Button', 'theme#ThemeToggle']),
    )
    expect(await discover('hook')).toContain('theme#useTheme')
  })

  it('every exported component has a fixture or a documented browser-only reason — none is forgotten', async () => {
    const missing = (await discover('component')).filter(
      (key) => !(key in COMPONENT_PROPS) && !(key in BROWSER_ONLY),
    )
    expect(
      missing,
      'add a line to tests/support/ssrFixtures.ts (or BROWSER_ONLY with a reason)',
    ).toEqual([])
  })

  it('every exported hook has a fixture or a documented browser-only reason — none is forgotten', async () => {
    const missing = (await discover('hook')).filter(
      (key) => !(key in HOOK_ARGS) && !(key in BROWSER_ONLY),
    )
    expect(
      missing,
      'add a line to tests/support/ssrFixtures.ts (or BROWSER_ONLY with a reason)',
    ).toEqual([])
  })

  it('has no stale fixtures and every browser-only entry names a reason and a real export', async () => {
    const known = new Set([...(await discover('component')), ...(await discover('hook'))])
    const stale = [
      ...Object.keys(COMPONENT_PROPS),
      ...Object.keys(HOOK_ARGS),
      ...Object.keys(BROWSER_ONLY),
    ]
      .filter((key) => known.has(key) === false)
      // 이 워크스페이스에 없는 패키지의 항목은 찍어 낸 프로젝트에서 자연스럽게 남는다
      .filter((key) => modules.has(key.slice(0, key.indexOf('#'))))
    expect(stale).toEqual([])
    for (const [key, reason] of Object.entries(BROWSER_ONLY)) {
      expect(reason.trim().length, `BROWSER_ONLY ${key} needs a reason`).toBeGreaterThan(10)
      expect(
        key in COMPONENT_PROPS || key in HOOK_ARGS,
        `${key} is browser-only and has a fixture`,
      ).toBe(false)
    }
  })

  it('server-renders each component with minimal props', async () => {
    const { render } = split(await discover('component'))
    expect(render.length).toBeGreaterThan(0)
    for (const key of render) {
      const [pkg, name] = key.split('#')
      const props = COMPONENT_PROPS[key]?.(ctx)
      if (!props) continue
      const component = ctx.mod(pkg)[name] as ComponentType<Record<string, unknown>>
      // 빈 글자일 수 있다(예: 로그인 안 한 방문자의 RequireAuth 는 이동만 한다) — 던지지 않고 경고도 없다는 것이 보장이다
      expect(typeof renderClean(page(createElement(component, props))), key).toBe('string')
    }
  })

  it('server-renders each hook inside a small component', async () => {
    const { render } = split(await discover('hook'))
    expect(render.length).toBeGreaterThan(0) // 찍어 낸 프로젝트는 패키지가 적다
    for (const key of render) {
      const [pkg, name] = key.split('#')
      const args = HOOK_ARGS[key]?.(ctx)
      if (!args) continue
      const hook = ctx.mod(pkg)[name] as (...a: unknown[]) => unknown
      const Probe = () => {
        hook(...args)
        return createElement('p', null, name)
      }
      expect(renderClean(page(createElement(Probe))), key).toContain(name)
    }
  })
})
