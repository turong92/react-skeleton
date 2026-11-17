import type { VideoPlayerLabels } from './labels'
import styles from './VideoPlayer.module.css'

/** 브라우저가 음소거 영상의 재생을 막았다(저전력 모드) - 포스터 위 재생 단추. 눌린 손짓 안에서 영상을 튼다 */
export function TapToWatch({
  labels,
  onClick,
}: {
  labels: Pick<VideoPlayerLabels, 'tapToWatch'>
  onClick: () => void
}) {
  return (
    <div className={styles.cover}>
      <button
        type="button"
        className={styles.play}
        aria-label={labels.tapToWatch}
        onClick={onClick}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <p className={styles.badge}>{labels.tapToWatch}</p>
    </div>
  )
}

/** 대기열 곡의 영상이 끝내 붙지 못했다 - 소리는 계속 난다는 한 줄과 다시 붙여 보는 단추 */
export function PictureFailed({
  labels,
  onRetry,
}: {
  labels: Pick<VideoPlayerLabels, 'pictureFailed' | 'retry'>
  onRetry: () => void
}) {
  return (
    <p role="alert" className={styles.problem}>
      {labels.pictureFailed}{' '}
      <button type="button" className={styles.chip} onClick={onRetry}>
        {labels.retry}
      </button>
    </p>
  )
}
