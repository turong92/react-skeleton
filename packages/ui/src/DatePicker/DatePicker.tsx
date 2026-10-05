import { formatDate, todayInZone, userTimeZone } from '@skeleton/time'
import type { InputHTMLAttributes } from 'react'
import { Button } from '../Button/Button'
import { Input } from '../Input/Input'
import { clampDate } from './dates'
import styles from './DatePicker.module.css'
import { useHydrated } from './useHydrated'

export type DatePickerProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'min' | 'max'
> & {
  /** 달력 날짜 `YYYY-MM-DD`(시간대 없음 — 생일을 어디서 봐도 같은 날). 비었으면 `''` */
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  invalid?: boolean
  /** 고른 날을 읽어 주는 글의 언어(BCP 47). 없으면 브라우저 언어 — 서버 렌더와 어긋나지 않게 이어받은 뒤에 그린다 */
  locale?: string
  /** 「오늘」을 셀 시간대(IANA). 기본 브라우저 시간대 */
  zone?: string
  /** 있으면 「오늘」 버튼이 생긴다 — 오늘(위 시간대)을 `min`/`max` 안으로 넣어 고른다 */
  todayLabel?: string
  /** 고른 날을 입력칸 아래에 풀어 쓴다(기본 true) */
  echo?: boolean
}

/**
 * 날짜 하나 고르기 — 네이티브 `<input type="date">` 위에. 달력 팝업 · 키보드 · 모바일 선택기 · 지역화를 브라우저가 이미 접근성 있게 해 주고,
 * 직접 만든 달력은 그 전부를 다시 만들어야 해서 두지 않았다(번들 0). 값은 `YYYY-MM-DD` 문자열이라 `@skeleton/time` 의 달력 날짜 규칙 그대로 — 시간대로 옮기지 않는다.
 * 보태는 것: 고른 날을 글로 읽어 주기(`formatDate`), 시간대에 맞는 「오늘」 버튼, `min`/`max`.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  invalid,
  locale,
  zone,
  todayLabel,
  echo = true,
  className,
  ...rest
}: DatePickerProps) {
  const hydrated = useHydrated()
  const readable = value && (locale || hydrated) ? formatDate(value, { locale }) : ''
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div className={styles.row}>
        <Input
          {...rest}
          type="date"
          value={value}
          min={min}
          max={max}
          invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
        {todayLabel && (
          <Button
            variant="secondary"
            size="sm"
            disabled={rest.disabled}
            onClick={() => onChange(clampDate(todayInZone(zone ?? userTimeZone()), min, max))}
          >
            {todayLabel}
          </Button>
        )}
      </div>
      {echo && (
        <span className={styles.echo} aria-live="polite">
          {readable}
        </span>
      )}
    </div>
  )
}
