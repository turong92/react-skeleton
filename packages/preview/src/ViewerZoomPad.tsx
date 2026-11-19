import { Button } from '@skeleton/ui'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { useId } from 'react'
import type { PreviewLabels } from './labels'
import type { PanZoom } from './usePanZoom'
import { zoomEnds } from './zoom'
import styles from './controls.module.css'

/**
 * 오른쪽 아래 유리 패드(좁은 결) — − · 맞추기(맞추기면 `aria-pressed`) · +. 판을 펴지 않고도 배율을 바꾼다.
 * 끝 단추는 `ZoomSelect` 와 같이 `aria-disabled` + 설명 연결(설명은 보이지 않는 현재 배율 글)
 */
export function ViewerZoomPad({ zoom, labels }: { zoom: PanZoom; labels: PreviewLabels }) {
  const id = useId()
  const { atMax, atMin } = zoomEnds(zoom.scale, zoom.fit)
  return (
    <div role="group" aria-label={labels.size} className={styles.pad}>
      <Button
        size="sm"
        variant="ghost"
        aria-label={labels.zoomOut}
        title={labels.zoomOut}
        aria-disabled={atMin || undefined}
        aria-describedby={atMin ? id : undefined}
        onClick={atMin ? undefined : () => zoom.zoomBy(-1)}
      >
        <Minus aria-hidden size={18} />
      </Button>
      <Button
        size="sm"
        variant={zoom.mode === 'fit' ? 'primary' : 'ghost'}
        aria-label={labels.fitButton}
        title={labels.fitButton}
        aria-pressed={zoom.mode === 'fit'}
        onClick={() => zoom.setScale('fit')}
      >
        <Maximize2 aria-hidden size={18} />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label={labels.zoomIn}
        title={labels.zoomIn}
        aria-disabled={atMax || undefined}
        aria-describedby={atMax ? id : undefined}
        onClick={atMax ? undefined : () => zoom.zoomBy(1)}
      >
        <Plus aria-hidden size={18} />
      </Button>
      <span id={id} hidden>
        {labels.percent(Math.round(zoom.scale * 100))}
      </span>
    </div>
  )
}
