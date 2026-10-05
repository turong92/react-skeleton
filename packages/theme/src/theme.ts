import { useSyncExternalStore } from 'react'
import { isTheme, THEME_STORAGE_KEY, THEMES, type Theme } from './themeNames'

export { isTheme, THEME_STORAGE_KEY, THEMES, type Theme }

/**
 * 화면 테마 — `<html data-theme="light|dark|system">` 하나가 전체 색을 바꾼다(styles/tokens.css 가 블록을 고른다).
 * system 은 CSS 의 `prefers-color-scheme` 이 OS 설정을 새로 고침 없이 따라간다 — 여기서 OS 를 읽지 않는다.
 * 고른 값은 보는 사람 브라우저의 localStorage 에만 둔다(비밀 아님). 막히거나 잘못된 값이면 system.
 * 첫 칠 전에는 `PRE_PAINT_SCRIPT`(prePaint.ts — 같은 키·이름 상수로 만든다)가 먼저 달고, 앱은 시작할 때 `initTheme()` 을 부른다.
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
// 모듈을 불러온다고 저장소를 읽거나 <html> 을 건드리지 않는다(서버 렌더 · 테스트 · 번들러가 import 만 해도 안전) — `initTheme()` 이 명시적으로 한다
let current: Theme = 'system'

export function getTheme(): Theme {
  return current
}

/** 서버 렌더 · 하이드레이션 첫 그림의 값 — 서버는 저장한 선택을 모르므로 항상 system. 하이드레이션이 끝나면 `getTheme()` 값으로 바뀐다 */
export function getServerTheme(): Theme {
  return 'system'
}

/**
 * 앱이 시작할 때 한 번 부른다(`main.tsx` · `entry-client.tsx`) — 저장한 선택을 읽어 `<html data-theme>` 에 달고 구독자에게 알린다.
 * 저장소가 막히면 system, 서버(document 없음)에서는 아무것도 달지 않는다. 첫 칠 전 깜빡임은 `PRE_PAINT_SCRIPT` 가 막는다.
 */
export function initTheme(): Theme {
  const stored = readStoredTheme()
  applyTheme(stored)
  if (stored !== current) {
    current = stored
    listeners.forEach((listener) => listener())
  }
  return stored
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
  return useSyncExternalStore(subscribeTheme, getTheme, getServerTheme)
}
