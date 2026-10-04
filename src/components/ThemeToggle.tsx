import { Monitor, Moon, Sun } from 'lucide-react'
import { nextTheme, setTheme, useTheme, type Theme } from '../lib/theme'
import styles from './ThemeToggle.module.css'

const ICONS: Record<Theme, typeof Sun> = { system: Monitor, light: Sun, dark: Moon }

/** 누를 때마다 system → light → dark. 고른 값은 theme.ts 가 저장하고 <html data-theme> 에 단다 */
export function ThemeToggle() {
  const theme = useTheme()
  const Icon = ICONS[theme]
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme} (click to change)`}
      onClick={() => setTheme(nextTheme(theme))}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  )
}
