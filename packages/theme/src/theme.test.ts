/// <reference types="node" />
import { runInNewContext } from 'node:vm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyTheme,
  getServerTheme,
  getTheme,
  initTheme,
  isTheme,
  nextTheme,
  readStoredTheme,
  setTheme,
  subscribeTheme,
  THEME_STORAGE_KEY,
  THEMES,
} from './theme'
import { PRE_PAINT_SCRIPT } from './prePaint'
import { themePrePaint } from './vite'

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

describe('initTheme — an explicit call, never an import side effect', () => {
  it('importing the module neither reads storage nor touches <html>, even when the browser globals exist', async () => {
    const reads: string[] = []
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => {
        reads.push(key)
        return 'dark'
      },
    })
    vi.resetModules()
    const fresh = await import('./theme')
    expect(reads).toEqual([])
    expect(html.dataset.theme).toBeUndefined()
    expect(fresh.getTheme()).toBe('system')
  })

  it('reads the stored choice, applies it to <html>, tells subscribers and returns it', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [THEME_STORAGE_KEY]: 'dark' }))
    const listener = vi.fn()
    const unsubscribe = subscribeTheme(listener)
    expect(initTheme()).toBe('dark')
    expect(html.dataset.theme).toBe('dark')
    expect(getTheme()).toBe('dark')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    setTheme('system')
  })

  it('falls back to system when storage is blocked, and is safe on a server (no document)', () => {
    vi.stubGlobal('localStorage', blockedStorage)
    expect(initTheme()).toBe('system')
    vi.stubGlobal('document', undefined)
    expect(() => initTheme()).not.toThrow()
  })

  it('getServerTheme is always system — the server render and the hydration render agree', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [THEME_STORAGE_KEY]: 'dark' }))
    initTheme()
    expect(getServerTheme()).toBe('system')
    setTheme('system')
  })
})

describe('the pre-paint script', () => {
  function runScript(stored: Record<string, string>, throws = false) {
    const target = { dataset: {} as Record<string, string | undefined> }
    const storage = throws ? blockedStorage : fakeStorage(stored)
    runInNewContext(PRE_PAINT_SCRIPT, {
      localStorage: storage,
      document: { documentElement: target },
    })
    return target.dataset.theme
  }

  it('sets data-theme from the same storage key as theme.ts', () => {
    expect(runScript({ [THEME_STORAGE_KEY]: 'dark' })).toBe('dark')
    expect(runScript({ [THEME_STORAGE_KEY]: 'light' })).toBe('light')
    expect(runScript({ [THEME_STORAGE_KEY]: 'system' })).toBe('system')
  })

  it('leaves data-theme alone for a missing or invalid value, and survives blocked storage', () => {
    expect(runScript({})).toBeUndefined()
    expect(runScript({ [THEME_STORAGE_KEY]: 'sepia' })).toBeUndefined()
    expect(runScript({}, true)).toBeUndefined()
  })

  it('is plain JavaScript that needs no module system, ready to inline in a <script> tag', () => {
    expect(PRE_PAINT_SCRIPT).not.toMatch(/\b(import|export|require)\b/)
    expect(PRE_PAINT_SCRIPT).not.toContain('</script')
  })
})

describe('themePrePaint (Vite plugin)', () => {
  it('injects the script into <head> before everything else', () => {
    const plugin = themePrePaint()
    expect(plugin.name).toBe('skeleton-theme-pre-paint')
    expect(plugin.transformIndexHtml()).toEqual([
      { tag: 'script', children: PRE_PAINT_SCRIPT, injectTo: 'head-prepend' },
    ])
  })
})
