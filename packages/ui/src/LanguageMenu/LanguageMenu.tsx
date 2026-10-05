import { Select } from '../Select/Select'
import styles from './LanguageMenu.module.css'

export type LanguageMenuProps = {
  /** 메뉴 이름(낭독) — 앱이 번역해 넘긴다 */
  label: string
  /** 지금 언어 코드 */
  value: string
  /** 선택지 — 자기 말로 쓴 이름(`한국어` · `English`) */
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  className?: string
}

/**
 * 화면 언어 메뉴 — 날 `<select>` + 지구본. i18n 라이브러리를 모른다(`@skeleton/i18n` 의 `useT()` 가 주는 `locale` · `localeOptions` · `setLocale` 을 잇는다).
 * 컨트롤과 선택지에 `lang` 을 달아 낭독기가 제 언어로 읽는다.
 */
export function LanguageMenu({ label, value, options, onChange, className }: LanguageMenuProps) {
  return (
    <span className={[styles.root, className].filter(Boolean).join(' ')}>
      <svg
        className={styles.icon}
        viewBox="0 0 16 16"
        width="16"
        height="16"
        aria-hidden="true"
        focusable="false"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="6.25" />
          <path d="M1.75 8h12.5" />
          <path d="M8 1.75c1.8 1.7 2.7 3.8 2.7 6.25S9.8 12.55 8 14.25C6.2 12.55 5.3 10.45 5.3 8S6.2 3.45 8 1.75Z" />
        </g>
      </svg>
      <Select
        className={styles.select}
        aria-label={label}
        lang={value}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} lang={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </span>
  )
}
