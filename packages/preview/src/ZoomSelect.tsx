import { Button, Select } from '@skeleton/ui'
import { Minus, Plus } from 'lucide-react'
import { useId } from 'react'
import type { PreviewLabels } from './labels'
import type { PanZoom } from './usePanZoom'
import { ZOOM_STEPS, zoomEnds } from './zoom'
import styles from './controls.module.css'

/**
 * 배율 — · 고르기(맞추기 (n%) · 50 ~ 200%) · +.
 * 끝에 닿은 단추(200% 의 +, 맞추기 아래의 −)는 `disabled` 가 아니라 `aria-disabled` + 핸들러 없음 + 설명 연결(지금 배율이 이유다)
 */
export function ZoomSelect({
  zoom,
  layout,
  labels,
}: {
  zoom: PanZoom
  layout: 'bar' | 'panel'
  labels: PreviewLabels
}) {
  const id = useId()
  const percent = Math.round(zoom.scale * 100)
  const value =
    zoom.mode === 'fit'
      ? 'fit'
      : (ZOOM_STEPS.find((step) => Math.abs(step - zoom.scale) < 1e-6)?.toString() ?? 'custom')
  const { atMax, atMin } = zoomEnds(zoom.scale, zoom.fit)
  const options = [
    ...(value === 'custom' ? [{ value: 'custom', label: labels.percent(percent) }] : []),
    { value: 'fit', label: labels.fit(Math.round(zoom.fit * 100)) },
    ...ZOOM_STEPS.map((step) => ({
      value: step.toString(),
      label: step === 1 ? labels.actual(100) : labels.percent(Math.round(step * 100)),
    })),
  ]
  return (
    <div className={styles.group} data-layout={layout}>
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
      <span className={styles.pick}>
        <Select
          id={id}
          aria-label={labels.size}
          value={value}
          onChange={(event) => {
            const next = event.target.value
            if (next === 'fit') zoom.setScale('fit')
            else if (next !== 'custom') zoom.setScale(Number(next))
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </span>
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
    </div>
  )
}
