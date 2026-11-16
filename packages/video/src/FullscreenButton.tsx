import type { VideoPlayerLabels } from './labels'
import styles from './VideoPlayer.module.css'

/** 무대 위 전체 화면 칩 - 우리 영상 · 유튜브가 같은 모양 · 같은 문구를 쓴다(눌림은 대기열이 등록받은 같은 `toggle`) */
export function FullscreenButton({
  labels,
  active,
  onClick,
}: {
  labels: Pick<VideoPlayerLabels, 'fullscreen' | 'exitFullscreen'>
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${styles.fullscreen}`}
      aria-label={active ? labels.exitFullscreen : labels.fullscreen}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      </svg>
    </button>
  )
}
