import { useState } from 'react'
import type { VideoPlayerLabels } from './labels'
import type { PlaybackPlan, QualityChoice } from './playbackPlan'
import styles from './VideoPlayer.module.css'

/** 화질 칩(자동 / 720p / 원본) - 칩을 누르면 목록이 열리고, 고르면 닫힌다 */
export function QualityMenu({
  plan,
  pick,
  labels,
  onChoose,
}: {
  plan: PlaybackPlan
  pick: QualityChoice
  labels: VideoPlayerLabels
  onChoose: (pick: QualityChoice) => void
}) {
  const [open, setOpen] = useState(false)
  const label = (choice: QualityChoice) =>
    choice === 'compat' ? '720p' : choice === 'orig' ? labels.original : labels.auto
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
        aria-label={`${labels.quality}: ${label(pick)}`}
        onClick={() => setOpen((value) => !value)}
      >
        {label(pick)}
      </button>
      {open && (
        <div role="menu" className={styles.menu} aria-label={labels.quality}>
          {plan.options.map((option) => {
            const off = option === 'compat' && plan.compatPending
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                className={styles.menuItem}
                aria-checked={option === pick}
                aria-disabled={off || undefined}
                onClick={() => {
                  if (off) return
                  setOpen(false)
                  onChoose(option)
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
