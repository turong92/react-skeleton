import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  loadYouTubeApi,
  watchReady,
  youtubeHandlers,
  youtubePlayerVars,
  type YouTubeApi,
  type YouTubePlayer,
} from './youtubeApi'
import { readBrowserEnv } from './browserEnv'
import { youtubeOutput, type MediaOutput } from './mediaOutput'
import { leaveFullscreenOf, toggleFullscreen } from './fullscreen'
import type { AudioHost } from './queueController'
import type { SoundClock } from './videoSync'
import { followSoundWithYoutube } from './youtubeFollow'
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
  /** 유튜브 자체 조작줄(`controls`) - 앱이 자기 조작줄을 그릴 때 끈다(기본 켬) */
  controls?: boolean
  /** 준비된 플레이어를 소리 내는 쪽으로 등록한다(진행 막대 · 음량) - 돌려받은 함수로 푼다. `QueueStage` 가 대기열에 잇는다 */
  registerOutput?: (output: MediaOutput) => () => void
  /** 이 틀의 전체 화면을 대기열에 등록한다(앱 조작줄의 `toggleFullscreen`) - `QueueStage` 가 잇는다 */
  fullscreenHost?: AudioHost['fullscreen']
  /**
   * 소리를 대기열 `<audio>` 가 내는 곡(따로 받아 둔 소리 판이 있는 유튜브) - 주면 음소거로 붙여 이 소리 시각을 따라간다.
   * 이때는 재생 · 멈춤 · 끝 · 진행을 대기열에 알리지 않는다(소리가 쥔다). 만들 때만 읽는다 - 바꾸려면 `key` 로 다시 만든다
   */
  follow?: SoundClock
  /** 시험 · 스토리용 - IFrame API 불러오기 */
  loadApi?: () => Promise<YouTubeApi>
}

const subscribeNothing = () => () => {}
const serverEnv = () => null

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
  controls = true,
  registerOutput,
  fullscreenHost,
  follow,
  loadApi = loadYouTubeApi,
}: YoutubeStageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // 서버(와 첫 하이드레이션)에서는 모른다. 틀(`requestFullscreen`)이 되는 기기만 - 아이폰은 iframe 을 감싼 틀을 전체 화면으로 못 한다
  const env = useSyncExternalStore(subscribeNothing, readBrowserEnv, serverEnv)
  const canFullscreen = env?.fullscreen === 'frame'
  const [isFullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  // 대기열(앱 조작줄)의 `toggleFullscreen` 이 부르는 `toggle` - 유튜브는 무대 위 칩이 없다(`controls` 가 켜져 있으면 iframe 자체 단추)
  const toggleStageFullscreen = () => {
    if (canFullscreen) toggleFullscreen('frame', stageRef.current, null, document)
  }
  const toggleRef = useRef(toggleStageFullscreen)
  useEffect(() => {
    toggleRef.current = toggleStageFullscreen
  })
  useEffect(() => {
    if (!canFullscreen || !fullscreenHost) return
    const stage = stageRef.current
    const off = fullscreenHost.register({ toggle: () => toggleRef.current() })
    return () => {
      off()
      leaveFullscreenOf(stage, document)
    }
  }, [canFullscreen, fullscreenHost])
  useEffect(() => {
    if (canFullscreen) fullscreenHost?.report(isFullscreen)
  }, [isFullscreen, canFullscreen, fullscreenHost])
  const playerRef = useRef<YouTubePlayer | null>(null)
  const latest = useRef({ playing, onEnded, onFailed, onPlaying, controls, registerOutput, follow })
  useEffect(() => {
    latest.current = { playing, onEnded, onFailed, onPlaying, controls, registerOutput, follow }
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let created: YouTubePlayer | null = null
    let stopWatching = () => {}
    let started = false
    let autoplayTimer: ReturnType<typeof setTimeout> | undefined
    let unregister = () => {}
    let stopFollowing = () => {}
    let out: ReturnType<typeof youtubeOutput> | null = null
    // 소리를 따라가는 화면이면 대기열에는 아무것도 알리지 않는다(실패해도 소리는 그대로 흐른다)
    const sound = latest.current.follow
    const tell = sound
      ? { onEnded: () => {}, onFailed: () => {}, onPlaying: () => {} }
      : {
          onEnded: () => latest.current.onEnded(),
          onFailed: () => latest.current.onFailed(),
          onPlaying: (v: boolean) => latest.current.onPlaying(v),
        }
    const target = document.createElement('div')
    host.appendChild(target)
    loadApi().then(
      (api) => {
        if (cancelled) return
        try {
          const handlers = youtubeHandlers(api.PlayerState, {
            onEnded: tell.onEnded,
            onFailed: () => {
              stopWatching() // 오류가 먼저 왔다 - 멈춘 대기열이 15초 뒤 저절로 다음 곡으로 가지 않게
              tell.onFailed()
            },
            onPlaying: (value) => {
              if (value) started = true
              // 재생이 시작되면 유튜브가 자막을 제 설정대로 다시 올린다 - 고른 값으로 되돌린다
              if (value) out?.reapplyCaptions()
              // 소리를 따라가는 화면은 자막 단추가 없다 - 유튜브가 제 설정대로 올린 자막을 내린다
              if (value && sound) {
                created?.unloadModule?.('captions')
                created?.unloadModule?.('cc')
              }
              tell.onPlaying(value)
            },
          })
          created = new api.Player(target, {
            videoId,
            playerVars: sound
              ? { ...youtubePlayerVars(true, false), mute: 1, disablekb: 1 }
              : youtubePlayerVars(latest.current.playing, latest.current.controls),
            events: {
              ...handlers,
              // 준비된 뒤에야 조작할 수 있다 - 그때 지금 원하는 재생 상태를 맞춘다
              // 자막 모듈은 재생 뒤 늦게 올라온다 — 올라올 때 고른 값으로 되돌린다
              onApiChange: () => out?.reapplyCaptions(),
              onReady: ({ target: ready }) => {
                stopWatching()
                if (cancelled) return
                if (sound) {
                  // 음소거로 붙여 소리 시각을 따라간다 - 진행 막대 · 음량은 대기열 <audio> 가 맡는다
                  ready.mute()
                  stopFollowing = followSoundWithYoutube(ready, api.PlayerState, sound)
                  return
                }
                playerRef.current = ready
                out = youtubeOutput(ready)
                unregister = latest.current.registerOutput?.(out) ?? unregister
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
          stopWatching = watchReady(() => tell.onFailed())
        } catch {
          tell.onFailed()
        }
      },
      () => {
        if (!cancelled) tell.onFailed()
      },
    )
    return () => {
      cancelled = true
      stopWatching()
      clearTimeout(autoplayTimer)
      stopFollowing()
      unregister()
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
      <div ref={stageRef} className={styles.stage} style={{ aspectRatio: '16/9' }}>
        {/* 소리를 따라가는 화면은 누를 수 없게 - 유튜브의 「음소거 해제」 · 키로 소리가 두 번 나지 않게 */}
        <div
          ref={hostRef}
          className={styles.frameHost}
          style={follow ? { pointerEvents: 'none' } : undefined}
        />
      </div>
    </div>
  )
}
