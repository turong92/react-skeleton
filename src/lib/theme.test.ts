/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyTheme,
  getTheme,
  isTheme,
  nextTheme,
  readStoredTheme,
  setTheme,
  subscribeTheme,
  THEME_STORAGE_KEY,
  THEMES,
} from './theme'

/*
 * node 환경(jsdom 없음)이라 브라우저 전역을 작은 실물 객체로 세운다 — localStorage 는 Map 기반, <html> 은 dataset 만 가진 객체.
 */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}
const blockedStorage = {
  getItem: () => {
    throw new DOMException('blocked', 'SecurityError')
  },
  setItem: () => {
    throw new DOMException('blocked', 'SecurityError')
  },
}
const html = { dataset: {} as Record<string, string | undefined> }

beforeEach(() => {
  html.dataset = {}
  vi.stubGlobal('document', { documentElement: html })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('theme preference', () => {
  it('the choices are system, light, dark', () => {
    expect(THEMES).toEqual(['system', 'light', 'dark'])
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('sepia')).toBe(false)
    expect(isTheme(null)).toBe(false)
  })

  it('reads the stored choice; missing or invalid falls back to system', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(readStoredTheme()).toBe('system')
    vi.stubGlobal('localStorage', fakeStorage({ [THEME_STORAGE_KEY]: 'dark' }))
    expect(readStoredTheme()).toBe('dark')
    vi.stubGlobal('localStorage', fakeStorage({ [THEME_STORAGE_KEY]: 'DARK' }))
    expect(readStoredTheme()).toBe('system')
  })

  it('falls back to system when storage throws (private window, blocked site data)', () => {
    vi.stubGlobal('localStorage', blockedStorage)
    expect(readStoredTheme()).toBe('system')
  })

  it('applyTheme sets <html data-theme>', () => {
    applyTheme('dark')
    expect(html.dataset.theme).toBe('dark')
    applyTheme('system')
    expect(html.dataset.theme).toBe('system')
  })

  it('setTheme applies, persists and notifies subscribers once per change', () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    const listener = vi.fn()
    const unsubscribe = subscribeTheme(listener)
    setTheme('dark')
    expect(html.dataset.theme).toBe('dark')
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('dark')
    expect(getTheme()).toBe('dark')
    expect(listener).toHaveBeenCalledTimes(1)
    setTheme('dark')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    setTheme('light')
    expect(listener).toHaveBeenCalledTimes(1)
    setTheme('system')
  })

  it('still applies for this tab when storage is blocked', () => {
    vi.stubGlobal('localStorage', blockedStorage)
    expect(() => setTheme('light')).not.toThrow()
    expect(html.dataset.theme).toBe('light')
    expect(getTheme()).toBe('light')
    setTheme('system')
  })

  it('nextTheme cycles system → light → dark → system', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
  })
})

describe('theme names and the pre-paint script', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url))

  it('THEMES is "system" plus the themes in design/tokens/tokens.json', () => {
    const json = JSON.parse(readFileSync(join(root, 'design/tokens/tokens.json'), 'utf8'))
    const names = (json.$extensions.skeleton.themes as { name: string }[]).map((t) => t.name)
    expect([...THEMES].sort()).toEqual(['system', ...names].sort())
  })

  function runInlineScript(stored: Record<string, string>, throws = false) {
    const page = readFileSync(join(root, 'index.html'), 'utf8')
    const script = /<script>([\s\S]*?)<\/script>/.exec(page)?.[1]
    expect(script, 'index.html needs an inline theme script').toBeTruthy()
    const target = { dataset: {} as Record<string, string | undefined> }
    const storage = throws ? blockedStorage : fakeStorage(stored)
    runInNewContext(script!, { localStorage: storage, document: { documentElement: target } })
    return target.dataset.theme
  }

  it('sets data-theme from the same storage key as theme.ts', () => {
    expect(runInlineScript({ [THEME_STORAGE_KEY]: 'dark' })).toBe('dark')
    expect(runInlineScript({ [THEME_STORAGE_KEY]: 'light' })).toBe('light')
    expect(runInlineScript({ [THEME_STORAGE_KEY]: 'system' })).toBe('system')
  })

  it('leaves data-theme alone for a missing or invalid value, and survives blocked storage', () => {
    expect(runInlineScript({})).toBeUndefined()
    expect(runInlineScript({ [THEME_STORAGE_KEY]: 'sepia' })).toBeUndefined()
    expect(runInlineScript({}, true)).toBeUndefined()
  })
})
