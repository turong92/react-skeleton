import { Button } from '@skeleton/ui'
import { ExternalLink, Hand, RotateCcw, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { DevicePicker } from './DevicePicker'
import type { PreviewDevice } from './devices'
import type { PreviewLabels } from './labels'
import type { PanZoom } from './usePanZoom'
import { ZoomSelect } from './ZoomSelect'
import controls from './controls.module.css'
import styles from './PreviewViewer.module.css'

type Props = {
  device: PreviewDevice
  onDevice: (device: PreviewDevice) => void
  zoom: PanZoom
  /** 앱이 꽂는 보기 조건 — 기기 고르기 다음 칸(구분선은 여기서) */
  extra?: ReactNode
  touch: boolean
  onTouch: (on: boolean) => void
  /** 있을 때만 「다시 재생」 */
  onReplay?: () => void
  onOpenWindow?: () => void
  onClose: () => void
  labels: PreviewLabels
}

/** 아래 가운데 떠 있는 막대(넓은 결) — 기기 | 앱 보기 조건 | 배율 | 만지기 · 다시 재생 | 새 창 · 닫기 */
export function ViewerBar({
  device,
  onDevice,
  zoom,
  extra,
  touch,
  onTouch,
  onReplay,
  onOpenWindow,
  onClose,
  labels,
}: Props) {
  return (
    <div role="group" aria-label={labels.controls} className={styles.bar}>
      <DevicePicker value={device} onChange={onDevice} labels={labels} />
      {extra && (
        <>
          <span className={styles.divider} aria-hidden />
          {extra}
        </>
      )}
      <span className={styles.divider} aria-hidden />
      <ZoomSelect zoom={zoom} layout="bar" labels={labels} />
      <span className={styles.divider} aria-hidden />
      <div className={controls.group}>
        <Button
          size="sm"
          variant={touch ? 'primary' : 'ghost'}
          aria-label={labels.touch}
          title={labels.touchNote}
          aria-pressed={touch}
          onClick={() => onTouch(!touch)}
        >
          <Hand aria-hidden size={20} />
        </Button>
        {onReplay && (
          <Button
            size="sm"
            variant="ghost"
            aria-label={labels.replay}
            title={labels.replay}
            onClick={onReplay}
          >
            <RotateCcw aria-hidden size={20} />
          </Button>
        )}
      </div>
      <span className={styles.divider} aria-hidden />
      <div className={controls.group}>
        {onOpenWindow && (
          <Button
            size="sm"
            variant="ghost"
            aria-label={labels.openWindow}
            title={labels.openWindow}
            onClick={onOpenWindow}
          >
            <ExternalLink aria-hidden size={20} />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          aria-label={labels.close}
          title={labels.close}
          onClick={onClose}
        >
          <X aria-hidden size={20} />
        </Button>
      </div>
    </div>
  )
}
