# @skeleton/theme

화면 테마(system · light · dark). `<html data-theme>` 하나가 전체 색을 바꾼다(색은 `@skeleton/tokens` 의 `tokens.css`).
peer: `react` `sonner` `lucide-react`. 다른 `@skeleton/*` 를 쓰지 않는다(색을 칠하려면 tokens.css 가 필요).

```ts
// vite.config.ts — 첫 칠 전에 저장한 테마를 <head> 에 인라인으로 넣는다(깜빡임 방지)
import { themePrePaint } from '@skeleton/theme/vite'
export default defineConfig({ plugins: [react(), themePrePaint()] })
```

```tsx
import { ThemeToggle, ThemedToaster, useTheme } from '@skeleton/theme'
<ThemeToggle />        // system → light → dark. label · title prop 으로 문구 교체
<ThemedToaster />      // sonner 토스트도 같은 테마를 따른다
```

| export                                                                                      | 뜻                                                                                        |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `getTheme` · `setTheme` · `subscribeTheme` · `useTheme`                                     | 고른 테마(localStorage 에 저장, 막혀도 이번 탭에는 적용)                                  |
| `readStoredTheme` · `applyTheme` · `nextTheme` · `isTheme` · `THEMES` · `THEME_STORAGE_KEY` | 보조                                                                                      |
| `ThemeToggle({ label?, title? })` · `ThemedToaster`                                         | 부품                                                                                      |
| `PRE_PAINT_SCRIPT`                                                                          | 첫 칠 전 스크립트 문자열(Vite 가 아니면 `index.html` 에 직접 인라인)                      |
| `@skeleton/theme/vite` → `themePrePaint()`                                                  | 위 스크립트를 `<head-prepend>` 에 넣는 Vite 플러그인(Node 22.18+ 가 `.ts` 를 직접 읽는다) |

테마 이름은 `packages/tokens/tokens.json` 의 목록과 같아야 한다(루트 `tests/theme.names.test.ts` 가 대조).
