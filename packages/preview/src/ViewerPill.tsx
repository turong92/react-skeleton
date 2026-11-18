import { Button } from '@skeleton/ui'
import { ChevronDown, X } from 'lucide-react'
import type { Ref } from 'react'
import { DEVICE_ICON } from './deviceIcons'
import type { PreviewLabels } from './labels'
import type { ViewerSummary } from './viewerSummary'
import styles from './ViewerNarrow.module.css'

/** 알약에 이을 글 — 기기 이름 · 배율 · 앱이 준 조각(있는 것만) */
function summaryText(summary: ViewerSummary, labels: PreviewLabels): string {
  const parts: string[] = []
  if (summary.device) parts.push(labels.devices[summary.device])
  if (summary.percent !== null) parts.push(labels.percent(summary.percent))
  parts.push(...summary.extra)
  return parts.join(' · ')
}

/**
 * 위 가운데 유리 알약(높이 48, 좁은 결) — 닫기 | 요약 | 펴기. 요약 앞은 기기 아이콘.
 * 요약이 길면 말줄임으로 줄고 닫기 · 펴기는 남는다. 판이 펴져 있는 동안은 감춘다(자리는 판이 쓴다)
 */
export function ViewerPill({
  summary,
  expanded,
  onExpand,
  onClose,
  panelId,
  pillRef,
  labels,
}: {
  summary: ViewerSummary
  expanded: boolean
  onExpand: () => void
  onClose: () => void
  panelId: string
  /** 알약 상자 — 접으면 포커스가 돌아올 펴기 단추를 여기서 찾는다 */
  pillRef?: Ref<HTMLDivElement>
  labels: PreviewLabels
}) {
  const Icon = summary.device ? DEVICE_ICON[summary.device] : null
  return (
    <div className={styles.pill} hidden={expanded} ref={pillRef}>
      <Button
        size="sm"
        variant="ghost"
        aria-label={labels.close}
        title={labels.close}
        onClick={onClose}
      >
        <X aria-hidden size={20} />
      </Button>
      <span className={styles.divider} aria-hidden />
      <span className={styles.summary}>
        {Icon && <Icon aria-hidden size={18} className={styles.deviceIcon} />}
        <span className={styles.summaryText}>{summaryText(summary, labels)}</span>
      </span>
      <Button
        size="sm"
        variant="ghost"
        aria-label={labels.expand}
        title={labels.expand}
        aria-expanded={expanded}
        aria-controls={panelId}
        data-expand
        onClick={onExpand}
      >
        <ChevronDown aria-hidden size={20} />
      </Button>
    </div>
  )
}
