import { ChoiceGroup } from '@skeleton/ui'
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { wakeAudio } from './autoAudio'
import { readBrowserEnv } from './browserEnv'
import { toggleFullscreen } from './fullscreen'
import { defaultVideoPlayerLabels } from './labels'
import { loadHlsLight } from './loadHls'
import { grantExpired, planPlayback, type QualityChoice } from './playbackPlan'
import { createPlayIntent } from './playIntent'
import { usePlayingReport, type Latest } from './playerRuntime'
import { playbackOf, type PlayerSource } from './playerSource'
import { initialPlayer, momentOf, reducePlayer, type PlayerMode } from './playerState'
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
  audioHost,
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

  const [state, dispatch] = useReducer(reducePlayer, initialMode, (mode) => ({
    ...initialPlayer,
    mode,
  }))
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

  const noEngine = plan !== null && plan.engine === null
  const waiting = plan !== null && plan.engine !== null && plan.order.length === 0
  const blocked = noEngine || waiting
  const ratio = grant.w > 0 && grant.h > 0 ? grant.w / grant.h : 16 / 9
  const badge = noEngine ? labels.unsupported : waiting ? labels.preparing : null
  const showVideo = playing && mode === 'video'
  const fullscreenKind = showVideo ? (env?.fullscreen ?? null) : null
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
            controls
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
        {fullscreenKind && (
          <button
            type="button"
            className={`${styles.chip} ${styles.fullscreen}`}
            aria-label={isFullscreen ? labels.exitFullscreen : labels.fullscreen}
            onClick={() =>
              toggleFullscreen(fullscreenKind, stageRef.current, videoRef.current, document)
            }
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        )}
        {showVideo && plan && plan.options.length > 1 && (
          <QualityMenu plan={plan} pick={state.pick} labels={labels} onChoose={choose} />
        )}
      </div>
      {audioOk && (
        <div className={styles.mode}>
          <ChoiceGroup
            aria-label={labels.mode}
            options={[
              { value: 'video', label: labels.modeVideo },
              { value: 'audio', label: labels.modeAudio },
            ]}
            value={mode}
            onChange={(value) => switchMode(value as PlayerMode)}
          />
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
