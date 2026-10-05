import { THEME_STORAGE_KEY, THEMES } from './themeNames.ts'

/**
 * 첫 칠 전에 저장한 테마를 `<html data-theme>` 에 단다(깜빡임 방지). `<head>` 에 인라인으로 넣는다 —
 * Vite 앱은 `@skeleton/theme/vite` 의 `themePrePaint()` 플러그인이 넣어 준다.
 * 키 · 이름은 themeNames.ts 의 상수에서 만들어 어긋날 수 없다. 저장소가 막혀도 던지지 않는다.
 */
export const PRE_PAINT_SCRIPT = `try {
  var theme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})
  if (${THEMES.map((name) => `theme === ${JSON.stringify(name)}`).join(' || ')})
    document.documentElement.dataset.theme = theme
} catch (e) {}`
