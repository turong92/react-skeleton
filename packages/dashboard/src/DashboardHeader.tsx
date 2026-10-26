import { Button, DateRangePicker, type DateRange } from '@skeleton/ui'
import type { ReactNode } from 'react'
import type { DashboardLabels } from './labels'
import { DASHBOARD_PERIODS, type DashboardPeriod } from './range'
import styles from './DashboardHeader.module.css'

export type DashboardHeaderProps = {
  subtitle?: string
  period: DashboardPeriod
  onPeriod: (period: DashboardPeriod) => void
  compare: boolean
  onCompare: (compare: boolean) => void
  /** 「직접」을 고른 동안 날짜 입력(적용 전 값) */
  customDraft: DateRange
  onCustomDraft: (value: DateRange) => void
  onApplyCustom: () => void
  /** 직접 고른 기간이 못 쓰일 때의 이유(`order` 시작이 끝보다 뒤 · `long` 366일 초과) */
  customProblem: 'order' | 'long' | null
  /** 날짜를 더 뒤로 못 고르게 하는 상한(오늘, 대시보드 시간대) */
  maxDate: string
  zone: string
  locale?: string
  labels: DashboardLabels
  /** 오른쪽 끝 자리 - 지금 N명, 편집 단추 같은 것이 들어온다 */
  trailing?: ReactNode
}

/** 제목 · 기간(오늘 / 7일 / 30일 / 직접) · 직전 기간 비교 · 오른쪽 자리. 고른 기간과 켠 비교는 눌린 모양으로 보인다(`aria-pressed`) */
export function DashboardHeader({
  subtitle,
  period,
  onPeriod,
  compare,
  onCompare,
  customDraft,
  onCustomDraft,
  onApplyCustom,
  customProblem,
  maxDate,
  zone,
  locale,
  labels,
  trailing,
}: DashboardHeaderProps) {
  const complete = customDraft.start !== '' && customDraft.end !== ''
  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <div className={styles.text}>
          <h1 className={styles.title}>{labels.title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <div className={styles.controls}>
          <div className={styles.group} role="group" aria-label={labels.periodGroup}>
            {DASHBOARD_PERIODS.map((value) => (
              <Button
                key={value}
                size="sm"
                variant={value === period ? 'primary' : 'secondary'}
                aria-pressed={value === period}
                onClick={() => onPeriod(value)}
              >
                {labels.periods[value]}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant={compare ? 'primary' : 'secondary'}
            aria-pressed={compare}
            onClick={() => onCompare(!compare)}
          >
            <span aria-hidden="true">{compare ? '✓' : '+'}</span>
            {labels.compare}
          </Button>
          {trailing}
        </div>
      </div>
      {period === 'custom' && (
        <div className={styles.custom}>
          <DateRangePicker
            legend={labels.customRange.legend}
            value={customDraft}
            onChange={onCustomDraft}
            startLabel={labels.customRange.start}
            endLabel={labels.customRange.end}
            max={maxDate}
            locale={locale}
            zone={zone}
            orderMessage={labels.customRange.orderProblem}
          />
          {customProblem === 'long' && (
            <p className={styles.problem} role="alert">
              {labels.customRange.longProblem}
            </p>
          )}
          <Button size="sm" disabled={!complete || customProblem !== null} onClick={onApplyCustom}>
            {labels.customRange.apply}
          </Button>
        </div>
      )}
    </header>
  )
}
