import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import type { PreviewDevice } from './devices'
import type { PreviewLabels } from './labels'
import type { PanZoom } from './usePanZoom'
import type { ViewerSummary } from './viewerSummary'
import { ViewerNotices } from './ViewerNotices'
import { ViewerPanel } from './ViewerPanel'
import { ViewerPill } from './ViewerPill'
import { ViewerZoomPad } from './ViewerZoomPad'
import styles from './ViewerNarrow.module.css'

type Props = {
  summary: ViewerSummary
  device: PreviewDevice
  onDevice: (device: PreviewDevice) => void
  zoom: PanZoom
  /** 앱이 꽂는 판 안 보기 조건 */
  panelExtra?: ReactNode
  touch: boolean
  onTouch: (on: boolean) => void
  onReplay?: () => void
  onOpenWindow?: () => void
  onClose: () => void
  /** 꽉 찬 폰 — 배율 패드가 없다 */
  fluid: boolean
  notices: Omit<ComponentProps<typeof ViewerNotices>, 'placement' | 'labels'>
  /** 펴기 판의 높이를 재는 요소 — 뷰어가 기기를 판 밑 칸에 맞춘다 */
  panelRef: (el: HTMLElement | null) => void
  labels: PreviewLabels
}

/**
 * 좁은 결(<1024) 겉 — 위 가운데 알약(펴면 한 판)과 그 아래 쌓인 안내, 오른쪽 아래 배율 패드(꽉 찬 폰은 없음).
 * 펴기 상태는 여기 둔다 — 넓은 결로 넘어가 이 부품이 사라지면 판도 함께 접힌다(막대가 같은 값을 보인다).
 * 판이 열린 동안은 Esc 가 판을 먼저 접고, 접으면 포커스는 펴기 단추로 돌아온다
 */
export function ViewerNarrow({
  summary,
  device,
  onDevice,
  zoom,
  panelExtra,
  touch,
  onTouch,
  onReplay,
  onOpenWindow,
  onClose,
  fluid,
  notices,
  panelRef,
  labels,
}: Props) {
  const panelId = useId()
  const [expanded, setExpanded] = useState(false)
  const pillRef = useRef<HTMLDivElement>(null)
  const wasExpanded = useRef(false)
  useEffect(() => {
    if (wasExpanded.current && !expanded)
      pillRef.current?.querySelector<HTMLElement>('[data-expand]')?.focus()
    wasExpanded.current = expanded
  }, [expanded])
  return (
    <>
      <div
        className={styles.top}
        onKeyDown={(event) => {
          // Esc 는 판을 먼저 접는다 — 막지 않으면 대화상자가 뷰어째 닫는다
          if (expanded && event.key === 'Escape') {
            event.preventDefault()
            setExpanded(false)
          }
        }}
      >
        <ViewerPill
          summary={summary}
          expanded={expanded}
          onExpand={() => setExpanded(true)}
          onClose={onClose}
          panelId={panelId}
          pillRef={pillRef}
          labels={labels}
        />
        {expanded && (
          <ViewerPanel
            id={panelId}
            device={device}
            onDevice={onDevice}
            zoom={zoom}
            extra={panelExtra}
            touch={touch}
            onTouch={onTouch}
            onReplay={onReplay}
            onOpenWindow={onOpenWindow}
            onCollapse={() => setExpanded(false)}
            onClose={onClose}
            sectionRef={panelRef}
            labels={labels}
          />
        )}
        {/* 판이 열려 있는 동안은 조작 안내를 감춘다 — 접으면 돌아오고, 기기가 그만큼 판 밑 칸을 더 쓴다 */}
        <ViewerNotices
          {...notices}
          hint={expanded ? null : notices.hint}
          placement="pill"
          labels={labels}
        />
      </div>
      {!fluid && !expanded && (
        <div className={styles.padSlot}>
          <ViewerZoomPad zoom={zoom} labels={labels} />
        </div>
      )}
    </>
  )
}
