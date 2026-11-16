import { useEffect, useRef } from 'react'
import {
  loadYouTubeApi,
  watchReady,
  youtubeHandlers,
  type YouTubeApi,
  type YouTubePlayer,
} from './youtubeApi'
import styles from './VideoPlayer.module.css'

export type YoutubeStageProps = {
  videoId: string
  /** 오를 때마다 같은 영상을 처음부터 다시 만든다(한 곡 반복 · 다시 틀기) */
  restart: number
  /** 이 순간 틀어야 하나 - 만들 때는 자동 재생 여부, 그 뒤에는 재생 · 멈춤을 맞춘다 */
  playing: boolean
  onEnded: () => void
  /** 틀 수 없다(onError 의 어떤 코드든 · IFrame API 스크립트를 못 불렀다) - 묻지 않고 대기열이 다음 곡으로 간다 */
  onFailed: () => void
  onPlaying: (playing: boolean) => void
  className?: string
  /** 시험 · 스토리용 - IFrame API 불러오기 */
  loadApi?: () => Promise<YouTubeApi>
}

/**
 * 유튜브 영상(IFrame Player API) - **영상으로만** 튼다(노래 모드 · 전환 단추 없음). 이 컴포넌트가 처음 그려질 때 비로소 API 스크립트를 부른다.
 * 끝나면 `onEnded`, 오류는 코드를 가리지 않고 `onFailed`
 */
export function YoutubeStage({
  videoId,
  restart,
  playing,
  onEnded,
  onFailed,
  onPlaying,
  className,
  loadApi = loadYouTubeApi,
}: YoutubeStageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const latest = useRef({ playing, onEnded, onFailed, onPlaying })
  useEffect(() => {
    latest.current = { playing, onEnded, onFailed, onPlaying }
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let created: YouTubePlayer | null = null
    let stopWatching = () => {}
    let started = false
    let autoplayTimer: ReturnType<typeof setTimeout> | undefined
    const target = document.createElement('div')
    host.appendChild(target)
    loadApi().then(
      (api) => {
        if (cancelled) return
        try {
          const handlers = youtubeHandlers(api.PlayerState, {
            onEnded: () => latest.current.onEnded(),
            onFailed: () => {
              stopWatching() // 오류가 먼저 왔다 - 멈춘 대기열이 15초 뒤 저절로 다음 곡으로 가지 않게
              latest.current.onFailed()
            },
            onPlaying: (value) => {
              if (value) started = true
              latest.current.onPlaying(value)
            },
          })
          created = new api.Player(target, {
            videoId,
            playerVars: { autoplay: latest.current.playing ? 1 : 0, playsinline: 1, rel: 0 },
            events: {
              ...handlers,
              // 준비된 뒤에야 조작할 수 있다 - 그때 지금 원하는 재생 상태를 맞춘다
              onReady: ({ target: ready }) => {
                stopWatching()
                if (cancelled) return
                playerRef.current = ready
                if (latest.current.playing) {
                  ready.playVideo()
                  // 손짓 없는 자동 재생을 브라우저가 막으면 틀고 있다고 하지 않는다(iframe 의 재생 단추가 남는다)
                  autoplayTimer = setTimeout(() => {
                    if (!started) latest.current.onPlaying(false)
                  }, 4000)
                } else ready.pauseVideo()
              },
            },
          })
          // 만든 뒤 준비가 안 되면 틀 수 없는 것으로 보고 다음 곡으로
          stopWatching = watchReady(() => latest.current.onFailed())
        } catch {
          latest.current.onFailed()
        }
      },
      () => {
        if (!cancelled) latest.current.onFailed()
      },
    )
    return () => {
      cancelled = true
      stopWatching()
      clearTimeout(autoplayTimer)
      created?.destroy()
      playerRef.current = null
      host.replaceChildren()
    }
  }, [videoId, restart, loadApi])

  // 앱의 작은 재생기 · 잠금화면에서 멈추거나 다시 틀면 영상도 따라간다
  useEffect(() => {
    if (playing) playerRef.current?.playVideo()
    else playerRef.current?.pauseVideo()
  }, [playing])

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div ref={hostRef} className={styles.stage} style={{ aspectRatio: '16/9' }} />
    </div>
  )
}
