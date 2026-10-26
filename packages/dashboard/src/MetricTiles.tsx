import { Switch } from '@skeleton/ui'
import type { ReactNode } from 'react'
import { deltaOf, formatPercent, formatValue, type Delta } from './format'
import type { DashboardLabels } from './labels'
import type { DashboardMetric } from './types'
import styles from './MetricTiles.module.css'

export type MetricTilesProps = {
  metrics: DashboardMetric[]
  /** 그래프에 올라간 지표 키 */
  selectedKey: string | null
  onSelect: (key: string) => void
  compare: boolean
  locale?: string
  labels: Pick<
    DashboardLabels,
    | 'tilesLabel'
    | 'metrics'
    | 'sources'
    | 'vsPrevious'
    | 'notComparable'
    | 'newValue'
    | 'tileUnavailable'
    | 'detailsLink'
    | 'currencySuffix'
    | 'edit'
  >
  /** 편집 중 - 끈 타일도 자리에 보이고 스위치로 켠다 */
  editing?: boolean
  /** 끈 타일의 지표 키 */
  hiddenKeys?: ReadonlySet<string>
  onToggle?: (key: string) => void
  /** `metric.link` 를 그리는 법(라우터 `Link` 를 끼운다). 기본은 `<a href>` */
  renderLink?: (href: string, children: ReactNode, className: string) => ReactNode
}

function DeltaText({
  delta,
  labels,
  locale,
}: {
  delta: Delta
  labels: MetricTilesProps['labels']
  locale?: string
}) {
  if (delta.kind === 'off') return null
  if (delta.kind === 'unavailable')
    return <span className={styles.muted}>{labels.notComparable}</span>
  const text =
    delta.kind === 'new'
      ? labels.newValue
      : delta.kind === 'flat'
        ? formatPercent(0, locale)
        : `${delta.kind === 'up' ? '▲' : '▼'} ${formatPercent(delta.percent, locale)}`
  return (
    <>
      <span className={styles.delta} data-dir={delta.kind}>
        {text}
      </span>
      <span className={styles.muted}>{labels.vsPrevious}</span>
    </>
  )
}

/**
 * 숫자 타일 줄 - 타일을 누르면 그 지표가 아래 그래프에 오른다(`aria-pressed`). 값 · 직전 기간 대비 증감 · 출처,
 * 돈은 통화마다 한 줄(첫 통화가 큰 숫자, 나머지는 아래 줄). 출처가 없으면(`NOT_CONNECTED` …) 숫자 대신 줄표.
 */
export function MetricTiles({
  metrics,
  selectedKey,
  onSelect,
  compare,
  locale,
  labels,
  editing = false,
  hiddenKeys,
  onToggle,
  renderLink = (href, children, className) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}: MetricTilesProps) {
  const shown = metrics.filter((m) => editing || !hiddenKeys?.has(m.key))
  return (
    <div
      className={styles.tiles}
      data-count={Math.min(Math.max(shown.length, 1), 6)}
      role="group"
      aria-label={labels.tilesLabel}
    >
      {shown.map((metric) => {
        const ok = metric.status === 'OK' && metric.value !== null && metric.value.length > 0
        const [first, ...rest] = metric.value ?? []
        const name = labels.metrics[metric.key] ?? metric.label
        const off = hiddenKeys?.has(metric.key) ?? false
        const format = (amount: typeof first) =>
          formatValue(amount, metric.unit, { locale, currencySuffix: labels.currencySuffix })
        const toggle = editing && (
          <Switch
            className={styles.toggle}
            label={labels.edit.show(name)}
            checked={!off}
            onChange={() => onToggle?.(metric.key)}
          />
        )
        if (off) {
          return (
            <div key={metric.key} className={styles.cell} data-off="true">
              <span className={styles.gone}>{labels.edit.off(name)}</span>
              {toggle}
            </div>
          )
        }
        return (
          <div key={metric.key} className={styles.cell}>
            <button
              type="button"
              className={styles.tile}
              aria-pressed={metric.key === selectedKey}
              onClick={() => onSelect(metric.key)}
            >
              <span className={styles.name}>{name}</span>
              <span className={styles.value}>{ok ? format(first) : labels.tileUnavailable}</span>
              {ok && rest.length > 0 && (
                <span className={styles.more}>
                  {rest.map((amount) => (
                    <span key={amount.currency ?? 'other'}>{format(amount)}</span>
                  ))}
                </span>
              )}
              {ok && (
                <span className={styles.deltaRow}>
                  <DeltaText delta={deltaOf(metric, compare)} labels={labels} locale={locale} />
                </span>
              )}
              <span className={styles.caption}>
                {labels.sources[metric.source] ?? metric.source}
              </span>
            </button>
            {metric.link && renderLink(metric.link, labels.detailsLink, styles.link)}
            {toggle}
          </div>
        )
      })}
    </div>
  )
}
