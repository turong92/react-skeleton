import { formatCount, formatPercent } from '../format'
import type { DashboardLabels } from '../labels'
import type { DashboardFunnel } from '../types'
import styles from './FunnelBars.module.css'

export type FunnelBarsProps = {
  funnel: DashboardFunnel
  labels: Pick<DashboardLabels, 'funnel' | 'funnelSteps'>
  locale?: string
}

type Stage = { key: string; label: string; value: number }

/**
 * 퍼널 막대 — 기준(방문 수 같은 것)이 있으면 맨 앞 단계, 이어서 서버가 주는 단계. 막대 길이는 첫 단계 대비 도달 수,
 * 글자는 「전 단계 대비 n%」(서버의 `rate` 는 첫 단계(묶음) 대비라 「전 단계 대비」는 도달 수에서 다시 계산한다). 첫 단계가 0 이면 막대는 가장 짧게.
 */
export function FunnelBars({ funnel, labels, locale }: FunnelBarsProps) {
  const stages: Stage[] = [
    ...(funnel.reference
      ? [
          {
            key: funnel.reference.key,
            label: funnel.reference.label,
            value: funnel.reference.value,
          },
        ]
      : []),
    ...funnel.steps.map((s) => ({ key: s.key, label: s.label, value: s.reached })),
  ].map((s) => ({ ...s, label: labels.funnelSteps[s.key] ?? s.label }))
  if (stages.length === 0) return <p className={styles.empty}>{labels.funnel.empty}</p>
  const first = stages[0].value
  const last = stages[stages.length - 1]
  return (
    <div className={styles.funnel}>
      <ol className={styles.steps}>
        {stages.map((stage, index) => {
          const previous = index > 0 ? stages[index - 1].value : null
          const rate = previous ? (stage.value / previous) * 100 : null
          return (
            <li key={stage.key} className={styles.step}>
              <div className={styles.head}>
                <span>{stage.label}</span>
                <b>{labels.funnel.people(formatCount(stage.value, locale))}</b>
              </div>
              <div className={styles.track} aria-hidden="true">
                <i
                  className={styles.bar}
                  data-last={index === stages.length - 1 && index > 0 ? 'true' : undefined}
                  style={{ width: `${Math.max(2, first > 0 ? (stage.value / first) * 100 : 0)}%` }}
                />
              </div>
              <div className={styles.meta}>
                {index === 0 ? (
                  labels.funnel.start
                ) : (
                  <>
                    {labels.funnel.fromPrevious(rate === null ? '-' : formatPercent(rate, locale))}
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {funnel.steps.length > 1 && (
        <p className={styles.summary}>
          {labels.funnel.ofCohort(
            labels.funnelSteps[funnel.steps[0].key] ?? funnel.steps[0].label,
            formatPercent(funnel.steps[funnel.steps.length - 1].rate * 100, locale),
          )}
        </p>
      )}
      {stages.length > 1 && (
        <p className={styles.summary}>
          {labels.funnel.overall(
            stages[0].label,
            last.label,
            first > 0 ? formatPercent((last.value / first) * 100, locale) : '-',
          )}
        </p>
      )}
    </div>
  )
}
