import { Dialog, Spinner } from '@skeleton/ui'
import type { DashboardApi } from './api'
import { useRanking } from './hooks'
import type { DashboardLabels } from './labels'
import { Provenance } from './Provenance'
import { RankingTable } from './RankingTable'
import { statusMessage } from './statusMessage'
import { StatusNotice } from './StatusNotice'
import type { DashboardRanking, DateSpan } from './types'

export type RankingDialogProps = {
  api: DashboardApi
  /** 열려 있는 순위(없으면 닫힘) */
  ranking: DashboardRanking | null
  span: DateSpan
  zone: string
  includesToday: boolean
  locale?: string
  labels: DashboardLabels
  onClose: () => void
}

/** 「전체 보기」 - 카드에는 몇 줄만 있는 순위를 상한(100줄)까지 서버에서 받아 대화상자에 보인다 */
export function RankingDialog({
  api,
  ranking,
  span,
  zone,
  includesToday,
  locale,
  labels,
  onClose,
}: RankingDialogProps) {
  const full = useRanking(api, ranking?.key ?? '', span, { enabled: ranking !== null })
  const name = ranking ? (labels.rankings[ranking.key] ?? ranking.label) : ''
  const data = full.data
  const message = data
    ? (statusMessage(data.status, data.source, labels) ??
      (data.rows.length === 0 ? labels.status.noRows : null))
    : null
  return (
    <Dialog
      open={ranking !== null}
      onClose={onClose}
      title={labels.viewAllTitle(name)}
      closeLabel={labels.close}
    >
      {full.isPending ? (
        <Spinner label={labels.loading} />
      ) : full.isError || !data ? (
        <StatusNotice message={labels.loadFailed} />
      ) : message ? (
        <StatusNotice message={message} />
      ) : (
        <>
          <RankingTable ranking={data} locale={locale} labels={labels} />
          <Provenance
            source={data.source}
            status={data.status}
            freshness={data.freshness}
            includesToday={includesToday}
            zone={zone}
            locale={locale}
            labels={labels}
          />
        </>
      )}
    </Dialog>
  )
}
