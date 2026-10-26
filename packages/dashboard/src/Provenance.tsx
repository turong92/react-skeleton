import { Badge } from '@skeleton/ui'
import type { ReactNode } from 'react'
import { formatAsOf } from './format'
import type { DashboardLabels } from './labels'
import type { DashboardFreshness, DashboardStatus } from './types'
import styles from './Provenance.module.css'

export type ProvenanceProps = {
  source: string
  status: DashboardStatus
  freshness: DashboardFreshness | null
  /** 조회 기간이 오늘을 포함하나 — 하루 한 번 적재하는 출처는 오늘 분이 내일 새벽에 온다 */
  includesToday: boolean
  zone: string
  locale?: string
  labels: Pick<DashboardLabels, 'sources' | 'freshness'>
  /** 오른쪽 끝에 놓을 것(예: 「전체 보기」 단추) */
  action?: ReactNode
}

/** 카드 · 그래프 아래의 출처 배지 + 신선도 한 줄 */
export function Provenance({
  source,
  status,
  freshness,
  includesToday,
  zone,
  locale,
  labels,
  action,
}: ProvenanceProps) {
  const asOf = freshness?.asOf ? formatAsOf(freshness.asOf, zone, locale) : null
  const text =
    status !== 'OK' || !freshness
      ? null
      : freshness.kind === 'LIVE'
        ? labels.freshness.live
        : asOf
          ? freshness.kind === 'DAILY'
            ? labels.freshness.daily(asOf)
            : labels.freshness.cached(asOf)
          : null
  return (
    <div className={styles.source}>
      <Badge>{labels.sources[source] ?? source}</Badge>
      {text && <span className={styles.note}>{text}</span>}
      {status === 'OK' && freshness?.kind === 'DAILY' && includesToday && (
        <Badge tone="warning">{labels.freshness.todayNote}</Badge>
      )}
      {action && <span className={styles.action}>{action}</span>}
    </div>
  )
}
