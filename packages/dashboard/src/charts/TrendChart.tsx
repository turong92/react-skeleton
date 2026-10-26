import { useId, useState, type PointerEvent } from 'react'
import { formatPointLabel } from '../format'
import type { DashboardInterval, DashboardPoint } from '../types'
import styles from './TrendChart.module.css'

export type TrendChartProps = {
  points: DashboardPoint[]
  /** 직전 기간(점선). 점의 개수가 달라도 각자 처음부터 끝까지 펼쳐 그린다 */
  previous?: DashboardPoint[] | null
  interval: DashboardInterval
  zone: string
  locale?: string
  /** 값을 글자로(툴팁) */
  formatValue: (value: number) => string
  /** 그래프의 이름(낭독기) */
  label: string
  currentLabel: string
  previousLabel: string
}

const WIDTH = 100
const HEIGHT = 40
const TOP = 2
const BOTTOM = 38

/**
 * 선 그래프 — SVG 로 직접 그린다(차트 라이브러리 없음). 이번 기간은 실선 + 면, 직전 기간은 점선.
 * 점선 · 실선은 색만으로 가르지 않는다(범례에 선 모양이 같이 나온다). 마우스를 올리거나 손가락으로 짚으면 그 시점의 값이 툴팁으로 뜬다.
 */
export function TrendChart({
  points,
  previous,
  interval,
  zone,
  locale,
  formatValue,
  label,
  currentLabel,
  previousLabel,
}: TrendChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const titleId = useId()
  const count = points.length
  const compared = previous && previous.length > 0 ? previous : null
  const values = [...points.map((p) => p.value), ...(compared?.map((p) => p.value) ?? [])]
  // 순매출처럼 음수가 나올 수 있다 - 가장 낮은 값이 0 보다 아래면 바닥을 내리고 0 기준선을 하나 긋는다
  const min = Math.min(0, ...values)
  const max = Math.max(min + 1, ...values)
  const x = (index: number, length: number) =>
    length > 1 ? (index / (length - 1)) * WIDTH : WIDTH / 2
  const y = (value: number) => BOTTOM - ((value - min) / (max - min)) * (BOTTOM - TOP)
  const zeroY = y(0)
  const line = (series: DashboardPoint[]) =>
    series.length === 1
      ? `0,${y(series[0].value)} ${WIDTH},${y(series[0].value)}`
      : series.map((p, i) => `${x(i, series.length)},${y(p.value)}`).join(' ')

  const labelAt = (index: number) => formatPointLabel(points[index].at, interval, zone, locale)
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || count === 0) return
    const ratio = (event.clientX - rect.left) / rect.width
    setActive(Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1)))))
  }
  const position = active === null ? 0 : x(active, count) / WIDTH

  return (
    <figure className={styles.figure}>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <i className={styles.swatch} data-line="current" aria-hidden="true" />
          {currentLabel}
        </span>
        {compared && (
          <span className={styles.legendItem}>
            <i className={styles.swatch} data-line="previous" aria-hidden="true" />
            {previousLabel}
          </span>
        )}
      </div>
      <div
        className={styles.chart}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setActive(null)}
        onPointerCancel={() => setActive(null)}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>{label}</title>
          {[0, 1, 2].map((row) => (
            <line
              key={row}
              className={styles.grid}
              x1={0}
              x2={WIDTH}
              y1={TOP + row * 18}
              y2={TOP + row * 18}
            />
          ))}
          {min < 0 && <line className={styles.zero} x1={0} x2={WIDTH} y1={zeroY} y2={zeroY} />}
          {compared && <polyline className={styles.previous} points={line(compared)} />}
          {count > 0 && (
            <>
              <polygon
                className={styles.area}
                points={`0,${zeroY} ${line(points)} ${WIDTH},${zeroY}`}
              />
              <polyline className={styles.current} points={line(points)} />
            </>
          )}
        </svg>
        {active !== null && (
          <>
            <i className={styles.guide} style={{ left: `${position * 100}%` }} aria-hidden="true" />
            <div
              className={styles.tip}
              style={{ left: `${position * 100}%` }}
              data-align={position < 0.2 ? 'start' : position > 0.8 ? 'end' : 'center'}
              aria-hidden="true"
            >
              <b>{labelAt(active)}</b>
              <span>
                {currentLabel} {formatValue(points[active].value)}
              </span>
              {compared && compared[active] && (
                <span>
                  {previousLabel} {formatValue(compared[active].value)}
                </span>
              )}
            </div>
          </>
        )}
      </div>
      {count > 0 && (
        <div className={styles.axis} aria-hidden="true">
          <span>{labelAt(0)}</span>
          <span>{labelAt(count >> 1)}</span>
          <span>{labelAt(count - 1)}</span>
        </div>
      )}
    </figure>
  )
}
