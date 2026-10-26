import { TrendChart } from './charts/TrendChart'
import { formatSeriesValue } from './format'
import type { DashboardLabels } from './labels'
import { Provenance } from './Provenance'
import { statusMessage } from './statusMessage'
import { StatusNotice } from './StatusNotice'
import type { DashboardMetric, DashboardRange } from './types'
import styles from './MetricChart.module.css'

export type MetricChartProps = {
  metric: DashboardMetric
  range: DashboardRange
  /** 직전 기간을 같이 그리나(`compare` 를 켠 상태) */
  compare: boolean
  includesToday: boolean
  /** `Provenance` 의 `now` */
  now?: number
  /** 기간 이름(「지난 7일」 …) - 제목 옆에 작게 */
  periodLabel: string
  locale?: string
  labels: DashboardLabels
}

/** 타일에서 고른 지표의 큰 그래프 + 출처 · 신선도. 숫자가 없는 상태(키 없음 · 오류 …)는 그래프 자리에 안내 */
export function MetricChart({
  metric,
  range,
  compare,
  includesToday,
  now,
  periodLabel,
  locale,
  labels,
}: MetricChartProps) {
  const name = labels.metrics[metric.key] ?? metric.label
  const message =
    statusMessage(metric.status, metric.source, labels) ??
    (!metric.series || metric.series.length === 0 ? labels.noSeries : null)
  return (
    <section className={styles.section} aria-labelledby={`chart-${metric.key}`}>
      <header className={styles.head}>
        <h2 id={`chart-${metric.key}`} className={styles.title}>
          {labels.trendTitle(name)}
        </h2>
        <span className={styles.period}>{periodLabel}</span>
      </header>
      {message ? (
        <StatusNotice message={message} />
      ) : (
        <TrendChart
          points={metric.series ?? []}
          previous={compare ? metric.previousSeries : null}
          interval={range.interval}
          zone={range.zone}
          locale={locale}
          formatValue={(value) =>
            formatSeriesValue(value, metric, { locale, currencySuffix: labels.currencySuffix })
          }
          label={labels.trendChartLabel(name)}
          currentLabel={labels.legendCurrent}
          previousLabel={labels.legendPrevious}
        />
      )}
      <Provenance
        source={metric.source}
        status={metric.status}
        freshness={metric.freshness}
        includesToday={includesToday}
        now={now}
        zone={range.zone}
        locale={locale}
        labels={labels}
      />
    </section>
  )
}
