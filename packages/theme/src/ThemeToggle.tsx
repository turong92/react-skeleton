import { Monitor, Moon, Sun } from 'lucide-react'
import { nextTheme, setTheme, useTheme, type Theme } from './theme'
import styles from './ThemeToggle.module.css'

const ICONS: Record<Theme, typeof Sun> = { system: Monitor, light: Sun, dark: Moon }

export type ThemeToggleProps = {
  /** 접근성 이름(기본 `Theme: system`) */
  label?: (theme: Theme) => string
  /** 마우스를 올렸을 때 말풍선(기본 `Theme: system (click to change)`) */
  title?: (theme: Theme) => string
}

/** 누를 때마다 system → light → dark. 고른 값은 theme.ts 가 저장하고 <html data-theme> 에 단다 */
export function ThemeToggle({
  label = (theme) => `Theme: ${theme}`,
  title = (theme) => `Theme: ${theme} (click to change)`,
}: ThemeToggleProps) {
  const theme = useTheme()
  const Icon = ICONS[theme]
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={label(theme)}
      title={title(theme)}
      onClick={() => setTheme(nextTheme(theme))}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  )
}
