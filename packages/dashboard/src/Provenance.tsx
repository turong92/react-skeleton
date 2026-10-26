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
  /** 지금(밀리초) - 「약 n분 전」 을 셀 기준. 없으면 그 문구 대신 갱신 시각을 쓴다(렌더 중에 시계를 읽지 않으려고 호출하는 쪽이 준다) */
  now?: number
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
  now,
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
  // 오늘이 든 기간의 외부 숫자: Cloudflare 오늘은 직접 질의라 「약 n분 전 기준」, GA 는 오늘을 적재 · 질의하지 않아 「GA 는 어제까지(n시 적재)」 - asOf 는 마지막 적재 시각
  const hourOf = (iso: string) =>
    new Intl.DateTimeFormat(locale, { timeZone: zone, hour: 'numeric', hour12: false }).format(
      new Date(iso),
    )
  const todayBadge =
    !includesToday || status !== 'OK' || !freshness?.asOf
      ? null
      : source === 'ga' && freshness.kind === 'DAILY'
        ? labels.freshness.gaThroughYesterday(hourOf(freshness.asOf))
        : source !== 'ga' && freshness.kind === 'CACHED' && now !== undefined
          ? labels.freshness.minutesAgo(
              Math.max(1, Math.round((now - new Date(freshness.asOf).getTime()) / 60_000)),
            )
          : null
  return (
    <div className={styles.source}>
      <Badge>{labels.sources[source] ?? source}</Badge>
      {text && !todayBadge && <span className={styles.note}>{text}</span>}
      {todayBadge && <Badge tone="warning">{todayBadge}</Badge>}
      {action && <span className={styles.action}>{action}</span>}
    </div>
  )
}
