import { usePlayQueue } from './usePlayQueue'
import type { QueueItem } from './playQueue'
import { defaultPlayQueueLabels, type PlayQueueLabels } from './queueLabels'
import styles from './MiniPlayer.module.css'

export type MiniPlayerViewProps = {
  item: QueueItem
  playing: boolean
  labels?: PlayQueueLabels
  className?: string
  /** 정보 칸을 눌렀다 - 앱이 큰 화면(재생 화면)으로 옮긴다. 없으면 정보 칸은 눌리지 않는다 */
  onOpen?: (item: QueueItem) => void
  onToggle: () => void
  onNext: () => void
}

/** 작은 재생기의 그림 - 상태 없이 값만 받으므로 서버 렌더로 확인한다 */
export function MiniPlayerView({
  item,
  playing,
  labels = defaultPlayQueueLabels,
  className,
  onOpen,
  onToggle,
  onNext,
}: MiniPlayerViewProps) {
  const info = (
    <>
      {item.thumb ? (
        <img className={styles.thumb} src={item.thumb} alt="" />
      ) : (
        <span className={styles.thumb} aria-hidden="true" />
      )}
      <span className={styles.text}>
        <span className={styles.title}>{item.title}</span>
        {item.artist && <span className={styles.artist}>{item.artist}</span>}
      </span>
    </>
  )
  return (
    <section
      className={[styles.root, className].filter(Boolean).join(' ')}
      aria-label={labels.miniPlayer}
    >
      {onOpen ? (
        <button
          type="button"
          className={styles.info}
          aria-label={labels.open(item.title)}
          onClick={() => onOpen(item)}
        >
          {info}
        </button>
      ) : (
        <div className={styles.info}>{info}</div>
      )}
      <button
        type="button"
        className={styles.button}
        aria-label={playing ? labels.pause : labels.play}
        onClick={onToggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={playing ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z'} />
        </svg>
      </button>
      <button type="button" className={styles.button} aria-label={labels.next} onClick={onNext}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 5l9 7-9 7zM17 5h2v14h-2z" />
        </svg>
      </button>
    </section>
  )
}

export type MiniPlayerProps = Pick<MiniPlayerViewProps, 'labels' | 'className' | 'onOpen'>

/**
 * 화면 아래에 붙는 작은 재생기 - 썸네일 · 제목 · 재생/일시정지 · 다음. 대기열이 비어 있으면 아무것도 그리지 않는다.
 * `PlayQueueProvider`(앱 최상단) 안 어디에든 한 번 둔다 - 라우트를 옮겨도 남는다
 */
export function MiniPlayer(props: MiniPlayerProps) {
  const { current, playing, toggle, next } = usePlayQueue()
  if (!current) return null
  return (
    <MiniPlayerView {...props} item={current} playing={playing} onToggle={toggle} onNext={next} />
  )
}
