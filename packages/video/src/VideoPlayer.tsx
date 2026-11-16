import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { wakeAudio } from './autoAudio'
import { readBrowserEnv } from './browserEnv'
import { leaveFullscreenOf, toggleFullscreen } from './fullscreen'
import { defaultVideoPlayerLabels } from './labels'
import { loadHlsLight } from './loadHls'
import { FullscreenButton } from './FullscreenButton'
import { elementOutput } from './mediaOutput'
import { ModePill } from './ModePill'
import { grantExpired, planPlayback, type QualityChoice } from './playbackPlan'
import { createPlayIntent } from './playIntent'
import { usePlayingReport, type Latest } from './playerRuntime'
import { playbackOf, type PlayerSource } from './playerSource'
import {
  followPlayback,
  followPreference,
  initialPlayer,
  momentOf,
  reducePlayer,
  type PlayerMode,
} from './playerState'
import { QualityMenu } from './QualityMenu'
import type { VideoPlayback } from './types'
import type { VideoPlayerProps } from './videoPlayerProps'
import { useHiddenHandoff } from './useHiddenHandoff'
import { useLockScreen } from './useLockScreen'
import { usePlayerMedia } from './usePlayerMedia'
import styles from './VideoPlayer.module.css'
import { formatDuration } from './videoView'

export type { VideoPlayerProps }

const subscribeNothing = () => () => {}
const serverEnv = () => null

/**
 * 영상 재생 - 포스터 + 재생 단추(누르기 전에는 영상 파일도 hls.js 도 받지 않는다). 순서는 마스터 → 원본 단 → 호환 단이고
 * 틀지 못하면 다음 순서로 같은 시각에서 넘어간다. 네이티브 HLS 가 없으면 hls.js light 를 누를 때 불러온다.
 * 판이 둘 이상이면 화질 칩(자동 / 720p / 원본)이 뜨고, 바꿔도 시각을 잇는다. 내려받기 단추는 없다.
 * 소리 판(`audio`)이 있으면 「영상 / 노래」 전환이 뜨고(같은 시각 · 같은 재생 상태로 잇는다, 노래에서는 영상 조각을 받지 않는다),
 * 소리 판이 실패하면 안내 한 줄과 함께 영상으로 되돌아온다. 잠금화면 단추(Media Session) · 전체 화면 단추가 붙는다
 */
export function VideoPlayer({
  grant: givenGrant,
  source,
  refreshGrant,
  labels = defaultVideoPlayerLabels,
  className,
  title,
  initialMode = 'video',
  autoAudioWhenHidden = false,
  onEnded,
  onPrevious,
  onNext,
  onModeChange,
  onPlayingChange,
  onFailed,
  autoStart = false,
  startSignal,
  joinSignal,
  followPlaying,
  audioHost,
  controls = true,
  modeToggle = true,
  preferredMode,
  preferSignal,
  env: envProp,
  loadHls = loadHlsLight,
}: VideoPlayerProps) {
  const given = givenGrant ?? playbackOf(source as PlayerSource)
  const [fresh, setFresh] = useState<{ from: VideoPlayback; value: VideoPlayback } | null>(null)
  const grant = fresh && fresh.from.src === given.src ? fresh.value : given
  // 서버(와 첫 하이드레이션)에서는 모른다 - 아는 순간 한 번 다시 그린다
  const deviceEnv = useSyncExternalStore(subscribeNothing, readBrowserEnv, serverEnv)
  const env = envProp ?? deviceEnv
  const plan = env ? planPlayback(grant, env) : null
  const audioOk = Boolean(grant.audio) && plan?.engine != null

  const [state, dispatch] = useReducer(reducePlayer, null, () => {
    // 대기열이 이 곡을 이미 소리로 틀고 있으면 처음부터 다시 틀지 않고 이어받는다(소리 모드 · 지금 위치 · 재생 상태)
    const joined = audioHost?.status()
    if (!joined) return { ...initialPlayer, mode: initialMode }
    return {
      ...initialPlayer,
      phase: 'playing' as const,
      mode: 'audio' as const,
      at: joined.at,
      play: joined.playing,
      adopt: true,
    }
  })
  const mode: PlayerMode = audioOk ? state.mode : 'video'
  const playing = state.phase === 'playing'
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // 대기열의 `<audio>` 를 빌릴 때는 그 요소를 쓴다(요소는 앱 최상단이 쥐고 있어 이 재생기가 사라져도 소리가 이어진다)
  const hostAudioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    hostAudioRef.current = audioHost?.element() ?? null
  })
  const refs = { video: videoRef, audio: audioHost ? hostAudioRef : audioRef }
  const latest = useRef<Latest>({ grant, plan, state, loadHls, given })
  useEffect(() => {
    latest.current = {
      grant,
      plan,
      state,
      refreshGrant,
      loadHls,
      given,
      onEnded,
      onPrevious,
      onNext,
      onModeChange,
      onPlayingChange,
      onFailed,
    }
  })
  const [intent] = useState(createPlayIntent)
  const report = usePlayingReport(latest)

  usePlayerMedia({
    latest,
    refs,
    intent,
    report,
    dispatch,
    setFresh,
    session: state.session,
    ready: plan?.engine != null,
    host: audioHost,
  })
  useHiddenHandoff({
    // 소리 판 실패로 영상에 돌아온 직후(notice)에는 다시 넘기지 않는다
    watching: autoAudioWhenHidden && playing && mode === 'video' && audioOk && !state.notice,
    engine: plan?.engine,
    latest,
    refs,
    intent,
    report,
    dispatch,
  })
  useLockScreen({
    // 대기열이 소리를 쥐고 있으면 잠금화면은 대기열이 묶는다
    playing: playing && !(audioHost && mode === 'audio'),
    title,
    poster: grant.poster,
    hasPrevious: Boolean(onPrevious),
    hasNext: Boolean(onNext),
    latest,
    refs,
    intent,
  })

  const lastMode = useRef<PlayerMode | null>(null)
  useEffect(() => {
    if (!playing || lastMode.current === state.mode) return
    lastMode.current = state.mode
    latest.current.onModeChange?.(state.mode)
  }, [playing, state.mode])

  // 화면의 <video> 를 대기열에 등록한다 - 진행 막대 · 음량이 노래 · 유튜브와 같은 손잡이로 이 요소를 다룬다(요소가 새로 생기면 지금 음량이 걸린다)
  const showingVideo = playing && mode === 'video'
  useEffect(() => {
    const video = videoRef.current
    if (!showingVideo || !video || !audioHost) return
    return audioHost.registerOutput(elementOutput(video))
  }, [showingVideo, audioHost])

  const [isFullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const press = async () => {
    if (!env) return
    // 첫 손짓 안(기다리기 전)에서 `<audio>` 를 깨워 둔다 - 나중에 화면이 꺼질 때 틀 수 있게
    if (
      (autoAudioWhenHidden || audioHost) &&
      mode === 'video' &&
      audioOk &&
      plan?.engine === 'native'
    ) {
      if (audioHost && grant.audio) audioHost.wake(grant.audio)
      else if (audioRef.current && grant.audio) wakeAudio(audioRef.current, grant.audio)
    }
    let g = grant
    if (refreshGrant && grantExpired(g, Date.now())) {
      try {
        g = await refreshGrant()
        setFresh({ from: given, value: g })
      } catch {
        dispatch({ type: 'giveUp' })
        return
      }
    }
    const first = planPlayback(g, env).order[0]
    if (first) dispatch({ type: 'press', kind: first, mode })
  }

  // 대기열이 이 곡을 영상으로 틀라고 한다(다음 곡으로 넘어옴 · 한 곡 반복 · 다시 틀기) - 신호가 바뀔 때마다 처음부터
  const startedFor = useRef<number | null | undefined>(autoStart ? null : startSignal)
  useEffect(() => {
    if (!autoStart || startSignal === undefined || !env || startedFor.current === startSignal)
      return
    startedFor.current = startSignal
    void press()
    // `press` 는 이 렌더의 값을 쓴다 - 신호 · 환경이 바뀔 때만 건다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, startSignal, env])

  useEffect(() => {
    if (state.phase === 'failed') latest.current.onFailed?.()
  }, [state.phase])

  // 대기열이 소리를 시작했다(예: 복원된 대기열을 큰 화면을 연 채 미니 플레이어로 재생) - 이어받는다
  const joinedFor = useRef(joinSignal)
  useEffect(() => {
    if (joinSignal === undefined || joinedFor.current === joinSignal) return
    joinedFor.current = joinSignal
    const joined = audioHost?.status()
    if (joined && audioOk) dispatch({ type: 'join', at: joined.at, play: joined.playing })
    // 신호가 바뀔 때만 건다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinSignal])

  // 영상 모드에서는 대기열의 재생 · 멈춤을 영상이 따른다(작은 재생기 · 잠금화면)
  useEffect(() => {
    const video = refs.video.current
    if (!video || state.phase !== 'playing' || mode !== 'video') return
    const todo = followPlayback(video.paused, followPlaying)
    if (todo === 'pause') video.pause()
    else if (todo === 'play') void video.play()?.catch(() => report(false))
    // 대기열의 재생 상태가 바뀔 때만 건다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followPlaying])

  const choose = (pick: QualityChoice) => {
    if (!plan) return
    if (pick === state.pick && (pick !== 'auto' || state.kind === plan.order[0])) return
    const kind = pick === 'auto' ? plan.order[0] : pick
    dispatch({ type: 'choose', pick, kind, at: videoRef.current?.currentTime ?? 0 })
  }

  const switchMode = (next: PlayerMode) => {
    if (next === mode) return
    if (!playing) {
      dispatch({ type: 'mode', mode: next, at: 0, play: false })
      return
    }
    const current = mode === 'audio' ? refs.audio.current : videoRef.current
    const kind =
      next === 'video' ? (state.pick === 'auto' ? plan?.order[0] : state.pick) : undefined
    if (next === 'video' && !kind) return
    dispatch({
      type: 'mode',
      mode: next,
      kind,
      // 한 번도 안 불러온 요소(미리 받기 없음)의 0 초를 잇지 않는다
      at: momentOf(current, state.at),
      play: current ? !current.paused : true,
    })
  }

  // 앱의 알약이 `setPreferred` 를 부를 때마다(값이 같아도) 재생 중에도 같은 시각 · 같은 재생 상태로 선호 모드로 옮겨 간다
  const preferredFor = useRef(preferSignal)
  useEffect(() => {
    if (preferSignal === undefined || preferredFor.current === preferSignal) return
    preferredFor.current = preferSignal
    const todo = followPreference(preferredMode, mode)
    if (todo && audioOk) switchMode(todo)
    // 신호가 바뀔 때만 건다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferSignal])

  const noEngine = plan !== null && plan.engine === null
  const waiting = plan !== null && plan.engine !== null && plan.order.length === 0
  const blocked = noEngine || waiting
  const ratio = grant.w > 0 && grant.h > 0 ? grant.w / grant.h : 16 / 9
  const badge = noEngine ? labels.unsupported : waiting ? labels.preparing : null
  const showVideo = playing && mode === 'video'
  const fullscreenKind = showVideo ? (env?.fullscreen ?? null) : null
  // 전체 화면 칩 · 대기열(앱 조작줄)이 같은 `toggle` 을 쓴다
  const toggleStageFullscreen = () => {
    if (fullscreenKind)
      toggleFullscreen(fullscreenKind, stageRef.current, videoRef.current, document)
  }
  const toggleRef = useRef(toggleStageFullscreen)
  useEffect(() => {
    toggleRef.current = toggleStageFullscreen
  })
  useEffect(() => {
    if (!fullscreenKind || !audioHost) return
    const stage = stageRef.current
    const off = audioHost.fullscreen.register({ toggle: () => toggleRef.current() })
    return () => {
      off()
      leaveFullscreenOf(stage, document)
    }
  }, [fullscreenKind, audioHost])
  useEffect(() => {
    if (fullscreenKind) audioHost?.fullscreen.report(isFullscreen)
  }, [isFullscreen, fullscreenKind, audioHost])
  const playLabel =
    mode === 'audio'
      ? labels.playAudio
      : grant.durationMs > 0
        ? labels.play(formatDuration(grant.durationMs))
        : labels.playNoLength

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div
        ref={stageRef}
        className={styles.stage}
        style={{
          aspectRatio: `${grant.w || 16}/${grant.h || 9}`,
          maxInlineSize: `min(100%, calc(80vh * ${ratio}))`,
        }}
      >
        {showVideo ? (
          <video
            ref={videoRef}
            className={styles.video}
            poster={grant.poster || undefined}
            controls={controls}
            playsInline
            preload="auto"
            controlsList="nodownload"
            aria-label={labels.video}
          />
        ) : (
          <>
            {grant.poster && <img className={styles.poster} src={grant.poster} alt="" />}
            {!playing && (
              <div className={styles.cover}>
                <button
                  type="button"
                  className={styles.play}
                  aria-label={playLabel}
                  disabled={blocked}
                  onClick={press}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
        {audioOk && !audioHost && (
          <audio
            ref={audioRef}
            className={styles.audio}
            controls={playing && mode === 'audio'}
            preload="none"
            aria-label={labels.modeAudio}
          />
        )}
        {badge && (
          <p className={styles.badge} role="status">
            {badge}
          </p>
        )}
        {fullscreenKind && controls && (
          <FullscreenButton labels={labels} active={isFullscreen} onClick={toggleStageFullscreen} />
        )}
        {showVideo && plan && plan.options.length > 1 && (
          <QualityMenu plan={plan} pick={state.pick} labels={labels} onChoose={choose} />
        )}
      </div>
      {audioOk && modeToggle && (
        <div className={styles.mode}>
          <ModePill labels={labels} mode={mode} onChange={switchMode} />
        </div>
      )}
      {state.notice && (
        <p role="status" className={styles.note}>
          {labels.audioFailed}
        </p>
      )}
      {state.phase === 'failed' && (
        <p role="alert" className={styles.problem}>
          {labels.failed}
        </p>
      )}
    </div>
  )
}
