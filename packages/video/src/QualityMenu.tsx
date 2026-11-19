import { useState } from 'react'
import type { VideoPlayerLabels } from './labels'
import type { QualityChoice } from './playbackPlan'
import { qualityLabel } from './qualityLabel'
import type { QualityOption } from './queueController'
import styles from './VideoPlayer.module.css'

/** 화질 칩(자동 (1080p) / 1080p / 720p …) - 칩을 누르면 목록이 열리고, 고르면 닫힌다. 이름은 실제 높이 */
export function QualityMenu({
  options,
  pick,
  playingHeight,
  labels,
  onChoose,
}: {
  options: QualityOption[]
  pick: QualityChoice
  /** 지금 실제로 나오는 높이 - 자동 옆에 보인다 */
  playingHeight: number | null
  labels: VideoPlayerLabels
  onChoose: (pick: QualityChoice) => void
}) {
  const [open, setOpen] = useState(false)
  const label = (option: QualityOption) =>
    qualityLabel(labels, option.value, option.height, playingHeight)
  const current = options.find((option) => option.value === pick) ?? options[0]!
  return (
    <div
      className={styles.quality}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        className={styles.chip}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${labels.quality}: ${label(current)}`}
        onClick={() => setOpen((value) => !value)}
      >
        {label(current)}
      </button>
      {open && (
        <div role="menu" className={styles.menu} aria-label={labels.quality}>
          {options.map((option) => {
            const off = option.pending === true
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                className={styles.menuItem}
                aria-checked={option.value === pick}
                aria-disabled={off || undefined}
                onClick={() => {
                  if (off) return
                  setOpen(false)
                  onChoose(option.value)
                }}
              >
                <span>{label(option)}</span>
                {off && <small>{labels.qualityPreparing}</small>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
