import { formatCount, formatPercent } from '../format'
import type { DashboardLabels } from '../labels'
import type { DashboardFunnel } from '../types'
import styles from './FunnelBars.module.css'

export type FunnelBarsProps = {
  funnel: DashboardFunnel
  labels: Pick<DashboardLabels, 'funnel' | 'funnelSteps'>
  locale?: string
}

/**
 * 퍼널 막대 - 서버가 주는 단계마다 막대 하나. 단계는 「묶음(맨 처음 단계의 사람들) 중 거기까지 간 사람」이라 서로 겹치지 않을 수 있어(결제했지만 돌아오지 않은 사람도 「결제」에 든다),
 * 막대 길이와 비율은 서버의 `rate`(묶음 대비)를 그대로 쓰고 「전 단계 대비」는 계산하지 않는다. 방문(`reference`)은 묶음이 아니라 익명 방문 수라
 * 막대가 아니라 퍼널 위의 참고 줄(「방문 n · 방문 대비 가입 x%」)로만 보인다.
 */
export function FunnelBars({ funnel, labels, locale }: FunnelBarsProps) {
  if (funnel.steps.length === 0) return <p className={styles.empty}>{labels.funnel.empty}</p>
  const name = (key: string, label: string) => labels.funnelSteps[key] ?? label
  const cohort = funnel.steps[0]
  const { reference } = funnel
  return (
    <div className={styles.funnel}>
      {reference && (
        <p className={styles.reference}>
          {labels.funnel.reference(
            name(reference.key, reference.label),
            formatCount(reference.value, locale),
            name(cohort.key, cohort.label),
            formatPercent(reference.rate * 100, locale),
          )}
        </p>
      )}
      <ol className={styles.steps}>
        {funnel.steps.map((step, index) => (
          <li key={step.key} className={styles.step}>
            <div className={styles.head}>
              <span>{name(step.key, step.label)}</span>
              <b>{labels.funnel.people(formatCount(step.reached, locale))}</b>
            </div>
            <div className={styles.track} aria-hidden="true">
              <i
                className={styles.bar}
                data-last={index === funnel.steps.length - 1 && index > 0 ? 'true' : undefined}
                style={{ width: `${Math.min(100, Math.max(2, step.rate * 100))}%` }}
              />
            </div>
            <div className={styles.meta}>
              {index === 0
                ? labels.funnel.start
                : labels.funnel.ofCohort(
                    name(cohort.key, cohort.label),
                    formatPercent(step.rate * 100, locale),
                  )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
