import { formatDate } from '@skeleton/time'
import { Field } from '../Field/Field'
import { DatePicker } from './DatePicker'
import { isIsoDate, rangeProblem } from './dates'
import styles from './DatePicker.module.css'
import { useHydrated } from './useHydrated'

export type DateRange = { start: string; end: string }

export type DateRangePickerProps = {
  /** 묶음의 이름(필수) — 무엇의 기간인가 */
  legend: string
  value: DateRange
  onChange: (value: DateRange) => void
  startLabel: string
  endLabel: string
  min?: string
  max?: string
  locale?: string
  zone?: string
  /** 「오늘」 버튼 글자(있으면 시작칸에 생긴다) */
  todayLabel?: string
  /** 끝이 시작보다 앞일 때 끝칸 아래에(기본 영어) */
  orderMessage?: string
  hint?: string
}

/**
 * 기간(시작 ~ 끝) 고르기 — `DatePicker` 둘을 `fieldset` 으로 묶는다. 시작은 끝 이전으로, 끝은 시작 이후로 제한되고(`min`/`max`),
 * 그래도 거꾸로 쳐 넣으면 끝칸에 오류(`role="alert"`)가 붙는다. 맞는 기간은 「시작 – 끝」 한 줄로 읽어 준다.
 */
export function DateRangePicker({
  legend,
  value,
  onChange,
  startLabel,
  endLabel,
  min,
  max,
  locale,
  zone,
  todayLabel,
  orderMessage = 'The end date must not be before the start date',
  hint,
}: DateRangePickerProps) {
  const hydrated = useHydrated()
  const problem = rangeProblem(value.start, value.end)
  const complete = isIsoDate(value.start) && isIsoDate(value.end) && !problem
  const summary =
    complete && (locale || hydrated)
      ? `${formatDate(value.start, { locale })} – ${formatDate(value.end, { locale })}`
      : ''
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.pair}>
        <Field label={startLabel} hint={hint}>
          {(control) => (
            <DatePicker
              {...control}
              value={value.start}
              onChange={(start) => onChange({ ...value, start })}
              min={min}
              max={value.end && isIsoDate(value.end) ? value.end : max}
              locale={locale}
              zone={zone}
              todayLabel={todayLabel}
              echo={false}
            />
          )}
        </Field>
        <Field label={endLabel} error={problem ? orderMessage : undefined}>
          {(control) => (
            <DatePicker
              {...control}
              value={value.end}
              onChange={(end) => onChange({ ...value, end })}
              min={value.start && isIsoDate(value.start) ? value.start : min}
              max={max}
              locale={locale}
              zone={zone}
              echo={false}
            />
          )}
        </Field>
      </div>
      <span className={styles.echo} aria-live="polite">
        {summary}
      </span>
    </fieldset>
  )
}
