import { useSyncExternalStore } from 'react'
import { isTheme, THEME_STORAGE_KEY, THEMES, type Theme } from './themeNames'

export { isTheme, THEME_STORAGE_KEY, THEMES, type Theme }

/**
 * 화면 테마 — `<html data-theme="light|dark|system">` 하나가 전체 색을 바꾼다(styles/tokens.css 가 블록을 고른다).
 * system 은 CSS 의 `prefers-color-scheme` 이 OS 설정을 새로 고침 없이 따라간다 — 여기서 OS 를 읽지 않는다.
 * 고른 값은 보는 사람 브라우저의 localStorage 에만 둔다(비밀 아님). 막히거나 잘못된 값이면 system.
 * 첫 칠 전에는 `PRE_PAINT_SCRIPT`(prePaint.ts — 같은 키·이름 상수로 만든다)가 먼저 단다.
 * 테마 이름은 packages/tokens/tokens.json 의 테마 목록과 같아야 한다(루트 tests/theme.names.test.ts 가 대조).
 */
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
