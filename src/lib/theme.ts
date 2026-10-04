import { useSyncExternalStore } from 'react'

/**
 * 화면 테마 — `<html data-theme="light|dark|system">` 하나가 전체 색을 바꾼다(styles/tokens.css 가 블록을 고른다).
 * system 은 CSS 의 `prefers-color-scheme` 이 OS 설정을 새로 고침 없이 따라간다 — 여기서 OS 를 읽지 않는다.
 * 고른 값은 보는 사람 브라우저의 localStorage 에만 둔다(비밀 아님). 막히거나 잘못된 값이면 system.
 * 첫 칠 전에는 index.html 의 인라인 스크립트가 같은 키로 먼저 단다(theme.test.ts 가 키를 대조).
 * 테마 이름은 design/tokens/tokens.json 의 테마 목록과 같아야 한다(tokens.test.ts 가 대조).
 */
export type Theme = 'system' | 'light' | 'dark'

export const THEMES: readonly Theme[] = ['system', 'light', 'dark']

export const THEME_STORAGE_KEY = 'theme'

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

/** 저장한 테마 — 없거나 · 잘못된 값이거나 · 저장소가 막히면(시크릿 창 · 차단) system */
export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme
}

/** 토글 버튼이 누를 때마다 system → light → dark → system */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
}

const listeners = new Set<() => void>()
let current: Theme = typeof window === 'undefined' ? 'system' : readStoredTheme()
applyTheme(current)

export function getTheme(): Theme {
  return current
}

/** 고르면 그 자리에서 바뀐다. 저장이 막혀도 이번 탭에는 적용된다 */
export function setTheme(next: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // 저장만 못 한다
  }
  applyTheme(next)
  if (next === current) return
  current = next
  listeners.forEach((listener) => listener())
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 고른 테마를 구독한다 — 토글에서 바꾸면 다시 그려진다 */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getTheme, getTheme)
}
