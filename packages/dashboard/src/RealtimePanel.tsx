import { formatCount } from './format'
import type { DashboardLabels } from './labels'
import { RankingTable } from './RankingTable'
import { StatusNotice } from './StatusNotice'
import type { DashboardRanking, DashboardRealtime } from './types'
import styles from './RealtimePanel.module.css'

export type RealtimePanelProps = {
  realtime: DashboardRealtime
  locale?: string
  labels: DashboardLabels
}

const asRanking = (
  key: string,
  label: string,
  column: string,
  rows: DashboardRealtime['pages'],
  labels: DashboardLabels,
): DashboardRanking => ({
  key,
  group: 'realtime',
  label,
  source: 'ga',
  status: 'OK',
  freshness: null,
  columns: [column, labels.realtime.users],
  rows,
})

/** 실시간 패널 - 지금 보는 사람 수, 많이 보는 페이지 · 국가. GA 가 센 쿠키 동의한 방문자만이라는 표기가 맨 위에 */
export function RealtimePanel({ realtime, locale, labels }: RealtimePanelProps) {
  const empty = realtime.pages.length === 0 && realtime.countries.length === 0
  return (
    <div className={styles.panel}>
      <p className={styles.count}>
        {labels.realtime.badge(formatCount(realtime.activeUsers ?? 0, locale))}
      </p>
      <p className={styles.note}>{labels.realtime.note}</p>
      {empty ? (
        <StatusNotice message={labels.realtime.empty} />
      ) : (
        <div className={styles.tables}>
          <RankingTable
            ranking={asRanking(
              'realtime.pages',
              labels.realtime.pages,
              labels.realtime.pages,
              realtime.pages,
              labels,
            )}
            locale={locale}
            labels={labels}
          />
          <RankingTable
            ranking={asRanking(
              'realtime.countries',
              labels.realtime.countries,
              labels.realtime.countries,
              realtime.countries,
              labels,
            )}
            locale={locale}
            labels={labels}
          />
        </div>
      )}
    </div>
  )
}
