import { nextChoiceIndex } from '@skeleton/ui'
import { useRef } from 'react'
import type { VideoPlayerLabels } from './labels'
import type { PlayerMode } from './playerState'
import styles from './ModePill.module.css'

/**
 * 「영상 / 노래」 작은 알약 전환 - WAI-ARIA radio group(화살표 · Home · End 로 옮기고 Tab 은 고른 칸에 한 번 멈춘다).
 * 이름은 `labels.mode`(묶음) · `labels.modeVideo` / `labels.modeAudio`(칸)
 */
export function ModePill({
  labels,
  mode,
  onChange,
}: {
  labels: Pick<VideoPlayerLabels, 'mode' | 'modeVideo' | 'modeAudio'>
  mode: PlayerMode
  onChange: (mode: PlayerMode) => void
}) {
  const group = useRef<HTMLDivElement>(null)
  const options: Array<{ value: PlayerMode; label: string }> = [
    { value: 'video', label: labels.modeVideo },
    { value: 'audio', label: labels.modeAudio },
  ]
  return (
    <div ref={group} role="radiogroup" aria-label={labels.mode} className={styles.pill}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === mode}
          tabIndex={option.value === mode ? 0 : -1}
          className={styles.segment}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            const next = nextChoiceIndex(event.key, index, options.length)
            if (next === null) return
            event.preventDefault()
            const target = options[next]
            if (target) onChange(target.value)
            group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
