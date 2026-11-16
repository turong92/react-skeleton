import { useContext, useRef, useState, type CSSProperties } from 'react'
import { defaultPlayQueueLabels, type PlayQueueLabels } from './queueLabels'
import { QueueContext } from './usePlayQueue'
import { useQueueProgress } from './useQueueProgress'
import { formatDuration } from './videoView'
import styles from './QueueProgress.module.css'

const clock = (seconds: number) => formatDuration(seconds * 1000)

export type QueueProgressViewProps = {
  currentTime: number
  duration: number
  onSeek: (seconds: number) => void
  labels?: PlayQueueLabels
  className?: string
}

/** 진행 막대의 그림 - 끌어 옮기는 동안은 놓을 때까지 손가락 자리를 보이고, 놓으면 그 시각으로 옮긴다(유튜브 · 소리 판에 옮기기를 연달아 걸지 않는다) */
export function QueueProgressView({
  currentTime,
  duration,
  onSeek,
  labels = defaultPlayQueueLabels,
  className,
}: QueueProgressViewProps) {
  const [scrub, setScrub] = useState<number | null>(null)
  const dragging = useRef(false)
  const shown = scrub ?? currentTime
  const release = () => {
    dragging.current = false
    if (scrub === null) return
    onSeek(scrub)
    setScrub(null)
  }
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <span className={styles.time}>{clock(shown)}</span>
      <input
        type="range"
        className={styles.range}
        min={0}
        max={duration}
        step={1}
        value={Math.min(Math.floor(shown), Math.floor(duration))}
        disabled={duration <= 0}
        aria-label={labels.seek}
        aria-valuetext={`${clock(shown)} / ${clock(duration)}`}
        onPointerDown={(event) => {
          dragging.current = true
          // 막대 밖에서 놓아도 끝을 받는다(취소 · 가로채기도 lostpointercapture 로 온다)
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }}
        onPointerUp={release}
        onLostPointerCapture={release}
        onChange={(event) => {
          const value = Number(event.target.value)
          // 키보드 · 보조 기기는 바로 옮긴다
          if (dragging.current) setScrub(value)
          else onSeek(value)
        }}
        style={{ '--progress': `${duration > 0 ? (shown / duration) * 100 : 0}%` } as CSSProperties}
      />
      <span className={styles.time}>{clock(duration)}</span>
    </div>
  )
}

export type QueueProgressProps = Pick<QueueProgressViewProps, 'labels' | 'className'>

/**
 * 진행 막대 - 지금 시각 / 길이와 끌어서 옮기기. 노래(대기열 `<audio>`) · 영상 · 유튜브 모두 같다.
 * 대기열 상태(`usePlayQueue`)가 아니라 이 부품만 초당 몇 번 다시 그려진다
 */
export function QueueProgress(props: QueueProgressProps) {
  // 대기열(Provider)이 없는 곳에서는 아무것도 그리지 않는다
  return useContext(QueueContext) ? <QueueProgressConnected {...props} /> : null
}

function QueueProgressConnected(props: QueueProgressProps) {
  const { currentTime, duration, seek } = useQueueProgress()
  return (
    <QueueProgressView {...props} currentTime={currentTime} duration={duration} onSeek={seek} />
  )
}
