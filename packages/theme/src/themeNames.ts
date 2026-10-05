/*
 * 테마 이름 · 저장 키 — DOM 을 건드리지 않는 순수 상수(vite.config.ts 같은 Node 쪽에서도 불러온다).
 * 테마 이름은 packages/tokens/tokens.json 의 테마 목록과 같아야 한다(루트 tests/theme.names.test.ts 가 대조).
 */
export type Theme = 'system' | 'light' | 'dark'

export const THEMES: readonly Theme[] = ['system', 'light', 'dark']

export const THEME_STORAGE_KEY = 'theme'

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}
