import { describe, expect, it } from 'vitest'
import { loadTurnstile, TURNSTILE_SCRIPT_SRC } from './loader'
import type { TurnstileApi } from './types'

/* 네트워크 없이 — document · window 를 가짜로 꽂는다(스크립트 태그가 붙고 onload 를 부르는 것까지만 흉내) */
type FakeScript = {
  src: string
  async: boolean
  defer: boolean
  onload: null | (() => void)
  onerror: null | (() => void)
}

function fakeEnv(initial?: TurnstileApi) {
  const scripts: FakeScript[] = []
  const win: { turnstile?: TurnstileApi } = { turnstile: initial }
  const env = {
    window: win,
    document: {
      createElement: () =>
        ({ src: '', async: false, defer: false, onload: null, onerror: null }) as FakeScript,
      head: { appendChild: (script: FakeScript) => void scripts.push(script) },
      querySelector: () => null,
    },
  }
  return { env: env as unknown as Parameters<typeof loadTurnstile>[0] & object, scripts, win }
}
const api = { render: () => 'w', reset: () => {}, remove: () => {} } as unknown as TurnstileApi

describe('loadTurnstile', () => {
  it('adds one explicit-render script and resolves with window.turnstile once it loads', async () => {
    const { env, scripts, win } = fakeEnv()
    const promise = loadTurnstile(env)
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe(TURNSTILE_SCRIPT_SRC)
    expect(TURNSTILE_SCRIPT_SRC).toContain('challenges.cloudflare.com/turnstile/v0/api.js')
    expect(TURNSTILE_SCRIPT_SRC).toContain('render=explicit')
    expect(scripts[0].async && scripts[0].defer).toBe(true)
    win.turnstile = api
    scripts[0].onload!()
    await expect(promise).resolves.toBe(api)
  })

  it('calling it again while loading shares the same script and promise', async () => {
    const { env, scripts, win } = fakeEnv()
    const a = loadTurnstile(env)
    const b = loadTurnstile(env)
    expect(a).toBe(b)
    expect(scripts).toHaveLength(1)
    win.turnstile = api
    scripts[0].onload!()
    await a
  })

  it('an already-present window.turnstile resolves without adding a script', async () => {
    const { env, scripts } = fakeEnv(api)
    await expect(loadTurnstile(env)).resolves.toBe(api)
    expect(scripts).toHaveLength(0)
  })

  it('a load error rejects, and the next call tries again with a fresh script', async () => {
    const { env, scripts, win } = fakeEnv()
    const first = loadTurnstile(env)
    scripts[0].onerror!()
    await expect(first).rejects.toThrow(/turnstile/i)
    const second = loadTurnstile(env)
    expect(scripts).toHaveLength(2)
    win.turnstile = api
    scripts[1].onload!()
    await expect(second).resolves.toBe(api)
  })

  it('a script that loads but leaves no window.turnstile is an error, not a hang', async () => {
    const { env, scripts } = fakeEnv()
    const promise = loadTurnstile(env)
    scripts[0].onload!()
    await expect(promise).rejects.toThrow(/turnstile/i)
  })

  it('the script address is configurable (self-hosted proxy, test double)', () => {
    const { env, scripts } = fakeEnv()
    void loadTurnstile({ ...env, src: 'https://proxy.test/api.js' }).catch(() => {})
    expect(scripts[0].src).toBe('https://proxy.test/api.js')
  })

  it('without a browser (server render) it rejects instead of touching document', async () => {
    await expect(loadTurnstile({ window: undefined, document: undefined })).rejects.toThrow(
      /browser/i,
    )
  })
})
