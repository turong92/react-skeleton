import { Button, Dialog } from '@skeleton/ui'
import { useState } from 'react'
import type { DashboardApi } from './api'
import { formatCount } from './format'
import { useRealtime } from './hooks'
import type { DashboardLabels } from './labels'
import { RealtimePanel } from './RealtimePanel'
import styles from './RealtimeBadge.module.css'

export type RealtimeBadgeProps = {
  api: DashboardApi
  locale?: string
  labels: DashboardLabels
}

/**
 * 헤더의 「지금 N명」 - 60초마다 갱신, 누르면 실시간 패널(페이지 · 국가, GA 가 센 동의한 방문자만).
 * 실시간 경로가 없거나(404) 출처가 연결되지 않았으면(`status` 가 `OK` 가 아님) 아무것도 그리지 않는다.
 */
export function RealtimeBadge({ api, locale, labels }: RealtimeBadgeProps) {
  const [open, setOpen] = useState(false)
  const query = useRealtime(api)
  const data = query.data
  if (!data || data.status !== 'OK' || data.activeUsers === null) return null
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className={styles.dot} aria-hidden="true" />
        {labels.realtime.badge(formatCount(data.activeUsers, locale))}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={labels.realtime.title}
        closeLabel={labels.close}
      >
        <RealtimePanel realtime={data} locale={locale} labels={labels} />
      </Dialog>
    </>
  )
}
