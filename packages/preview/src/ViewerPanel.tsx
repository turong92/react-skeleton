import { Button, SwitchRow } from '@skeleton/ui'
import { ChevronUp, RotateCcw, X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { DevicePicker } from './DevicePicker'
import type { PreviewDevice } from './devices'
import type { PreviewLabels } from './labels'
import type { PanZoom } from './usePanZoom'
import { ZoomSelect } from './ZoomSelect'
import styles from './ViewerNarrow.module.css'

type Props = {
  id: string
  device: PreviewDevice
  onDevice: (device: PreviewDevice) => void
  zoom: PanZoom
  /** 앱이 꽂는 보기 조건 — 기기 · 크기 다음 */
  extra?: ReactNode
  touch: boolean
  onTouch: (on: boolean) => void
  /** 있을 때만 */
  onReplay?: () => void
  onOpenWindow?: () => void
  onCollapse: () => void
  onClose: () => void
  sectionRef?: (el: HTMLElement | null) => void
  labels: PreviewLabels
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <p className={styles.label}>{label}</p>
      {children}
    </div>
  )
}

/**
 * 펴기 판(좁은 결) — 머리(닫기 · 제목 · 접기) + 기기 · 크기 · 앱 보기 조건 + 만지기 스위치 + 다시 재생 + 새 창.
 * 태블릿 세로(721~1023)는 폭 700 안에서 두 칸. 열리면 접기 단추로 포커스가 온다
 */
export function ViewerPanel({
  id,
  device,
  onDevice,
  zoom,
  extra,
  touch,
  onTouch,
  onReplay,
  onOpenWindow,
  onCollapse,
  onClose,
  sectionRef,
  labels,
}: Props) {
  const section = useRef<HTMLElement | null>(null)
  useEffect(() => section.current?.querySelector<HTMLElement>('[data-fold]')?.focus(), [])
  const touchId = useId()
  return (
    <section
      id={id}
      ref={(el) => {
        section.current = el
        sectionRef?.(el)
      }}
      data-viewer-panel
      aria-label={labels.panelTitle}
      className={styles.panel}
    >
      <div className={styles.head}>
        <Button
          size="sm"
          variant="ghost"
          aria-label={labels.close}
          title={labels.close}
          onClick={onClose}
        >
          <X aria-hidden size={20} />
        </Button>
        <h2 className={styles.title}>{labels.panelTitle}</h2>
        <Button
          size="sm"
          variant="ghost"
          aria-label={labels.collapse}
          title={labels.collapse}
          data-fold
          onClick={onCollapse}
        >
          <ChevronUp aria-hidden size={20} />
        </Button>
      </div>
      <div className={styles.cols}>
        <div className={styles.col} data-col>
          <Field label={labels.device}>
            <DevicePicker value={device} onChange={onDevice} labels={labels} />
          </Field>
          <Field label={labels.size}>
            <ZoomSelect zoom={zoom} layout="panel" labels={labels} />
          </Field>
          {extra}
        </div>
        <div className={styles.col} data-col>
          <div className={styles.visitor}>
            <SwitchRow
              id={touchId}
              title={labels.touch}
              description={labels.touchNote}
              checked={touch}
              onChange={onTouch}
            />
          </div>
        </div>
      </div>
      {onReplay && (
        <Button variant="secondary" className={styles.wide} onClick={onReplay}>
          <RotateCcw aria-hidden size={16} />
          {labels.replay}
        </Button>
      )}
      {onOpenWindow && (
        <Button variant="ghost" className={styles.wide} onClick={onOpenWindow}>
          {labels.openWindow}
        </Button>
      )}
    </section>
  )
}
