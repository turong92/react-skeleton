import { ChoiceGroup } from '@skeleton/ui'
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { attachSource, type LoadHls } from './attachSource'
import { wakeAudio, watchHidden } from './autoAudio'
import { enterFullscreen, fullscreenKindOf } from './fullscreen'
import { defaultVideoPlayerLabels, type VideoPlayerLabels } from './labels'
import { loadHlsLight } from './loadHls'
import { bindMediaSession } from './mediaSession'
import { playbackOf, type MediaSource } from './mediaSource'
import { createPlayIntent } from './playIntent'
import {
  afterFailure,
  grantExpired,
  HLS_MIME,
  nativeHlsIsReliable,
  planPlayback,
  urlOf,
  type PlaybackEnv,
  type QualityChoice,
} from './playbackPlan'
import { initialPlayer, reducePlayer, type PlayerMode } from './playerState'
import type { VideoPlayback } from './types'
import styles from './VideoPlayer.module.css'
import { formatDuration } from './videoView'

type Input =
  | {
      /** `api.playback(id)` 의 응답 */
      grant: VideoPlayback
      source?: undefined
      /**
       * 비공개 영상은 토큰이 끝나면 조각을 못 받는다 - 새 재생 허가(`api.playback(id)`)를 받아 오는 함수를 주면
       * 끝난 것을 알아챈 순간 새 허가로 **같은 시각에서** 이어 보인다. 공개 영상은 필요 없다
       */
      refreshGrant?: () => Promise<VideoPlayback>
    }
  | {
      grant?: undefined
      /** 서버 재생 허가 없이 같은 출처 주소를 그대로 튼다(쿠키 인증) - 만료 · 새 허가는 없다 */
      source: MediaSource
      refreshGrant?: undefined
    }

export type VideoPlayerProps = Input & {
  labels?: VideoPlayerLabels
  className?: string
  /** 잠금화면 · 알림에 뜨는 제목 - 모듈은 영상 제목을 모르니 앱이 준다 */
  title?: string
  /** 처음 모드 - 소리 판이 있을 때만 `audio`(노래)로 시작한다 */
  initialMode?: PlayerMode
  /** 영상으로 재생 중 화면이 꺼지거나 앱을 나가면 같은 시각의 소리 판으로 넘긴다(기본 꺼짐) */
  autoAudioWhenHidden?: boolean
  /** 끝까지 틀었다 - 재생 대기열이 다음 곡으로 엮는다 */
  onEnded?: () => void
  /** 주면 잠금화면에 이전/다음 곡 단추가 뜬다(그러면 ±10초 단추는 안 뜬다) */
  onPrevious?: () => void
  onNext?: () => void
  /** 모드가 바뀔 때(전환 · 자동 전환 · 소리 판 실패로 영상 복귀) */
  onModeChange?: (mode: PlayerMode) => void
  /** 사용자가 틀고 멈출 때 - 화면 끌 때 OS 가 멈추는 것은 세지 않는다 */
  onPlayingChange?: (playing: boolean) => void
  /** 시험 · 스토리용 - 이 기기가 무엇을 트는가(기본은 브라우저에서 읽는다) */
  env?: PlaybackEnv
  /** 시험 · 스토리용 - hls.js 불러오기(기본은 light 빌드 지연 import) */
  loadHls?: LoadHls
}

let browserEnv: PlaybackEnv | undefined

/** 이 기기가 무엇을 트는가 - 브라우저에서 한 번만 읽는다(서버에서는 모른다) */
function readBrowserEnv(): PlaybackEnv {
  if (browserEnv) return browserEnv
  const probe = document.createElement('video')
  const w = window as unknown as Record<string, { isTypeSupported?: (type: string) => boolean }>
  const mse = w.MediaSource ?? w.ManagedMediaSource
  const brands = (
    navigator as { userAgentData?: { brands?: Array<{ brand: string }> } }
  ).userAgentData?.brands?.map((entry) => entry.brand)
  const hlsReliable = nativeHlsIsReliable(navigator.userAgent, brands)
  browserEnv = {
    canPlayType: (mime) =>
      typeof probe.canPlayType === 'function' &&
      (hlsReliable || mime !== HLS_MIME) &&
      Boolean(probe.canPlayType(mime)),
    mse:
      mse && typeof mse.isTypeSupported === 'function'
        ? { isTypeSupported: (t) => mse.isTypeSupported!(t) }
        : null,
    fullscreen: fullscreenKindOf(
      document,
      (window as unknown as { HTMLVideoElement?: { prototype: object } }).HTMLVideoElement
        ?.prototype,
    ),
  }
  return browserEnv
}

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
  env: envProp,
  loadHls = loadHlsLight,
}: VideoPlayerProps) {
  const given = givenGrant ?? playbackOf(source as MediaSource)
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
  const [menuOpen, setMenuOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const latest = useRef({
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
  })
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

  // 걸음 · 모드 · 허가가 바뀔 때마다 요소(영상 또는 소리)에 다시 붙인다
  useEffect(() => {
    const { grant: g, plan: p, state: s, loadHls: load } = latest.current
    const audioMode = s.mode === 'audio'
    const media = audioMode ? audioRef.current : videoRef.current
    const url = audioMode ? g.audio : s.kind ? urlOf(g, s.kind) : null
    if (s.phase !== 'playing' || !media || !p?.engine || !url) return
    let settled = false
    const fail = () => {
      if (settled) return
      settled = true
      const now = latest.current
      const at = media.currentTime || s.at
      const decision = afterFailure({
        grant: now.grant,
        order: audioMode ? [] : (now.plan?.order ?? []),
        tried: audioMode ? [] : now.state.tried,
        now: Date.now(),
        canRefresh: Boolean(now.refreshGrant),
        refreshed: now.state.refreshed,
      })
      if (decision.action === 'next') dispatch({ type: 'next', kind: decision.kind, at })
      else if (decision.action === 'give-up') {
        // 소리 판이 안 되면 영상 걸음 순서로 같은 시각에서
        const back = now.plan?.order[0]
        if (audioMode && back) dispatch({ type: 'audioFailed', kind: back, at })
        else dispatch({ type: 'giveUp' })
      } else
        now.refreshGrant!().then(
          (value) => {
            setFresh({ from: now.given, value })
            dispatch({ type: 'refresh', at })
          },
          () => dispatch({ type: 'giveUp' }),
        )
    }
    const onPlay = () => {
      intent.play()
      latest.current.onPlayingChange?.(true)
    }
    const onPause = () => {
      intent.pause()
      latest.current.onPlayingChange?.(false)
    }
    const onEnd = () => {
      intent.ended()
      latest.current.onPlayingChange?.(false)
      latest.current.onEnded?.()
    }
    media.addEventListener('play', onPlay)
    media.addEventListener('pause', onPause)
    media.addEventListener('ended', onEnd)
    media.addEventListener('error', fail)
    let handle: { destroy: () => void } | null = null
    if (s.adopt) {
      // 화면이 꺼지는 순간 `<audio>` 가 이미 틀기 시작했다 - 다시 붙이면 끊긴다
      if (!media.paused) intent.play()
    } else {
      handle = attachSource(media, url, p.engine, { loadHls: load, onFatal: fail, startAt: s.at })
      if (s.play) void media.play()?.catch(() => {})
    }
    return () => {
      media.removeEventListener('play', onPlay)
      media.removeEventListener('pause', onPause)
      media.removeEventListener('ended', onEnd)
      media.removeEventListener('error', fail)
      handle?.destroy()
      media.pause()
      if (!audioMode) {
        // 떼어 낸 영상이 조각을 계속 받지 않게(소리 `<audio>` 는 깨워 둔 채로 남긴다)
        media.removeAttribute('src')
        media.load()
      }
    }
  }, [state.session, intent])

  // 영상으로 재생 중 화면이 꺼지면 같은 시각의 소리 판으로
  const handoffEngine = plan?.engine
  const watching = autoAudioWhenHidden && state.phase === 'playing' && mode === 'video' && audioOk
  useEffect(() => {
    if (!watching || !handoffEngine) return
    return watchHidden({
      doc: document,
      intent,
      video: () => videoRef.current,
      audio: () => (audioRef.current?.getAttribute('src') ? audioRef.current : null),
      native: handoffEngine === 'native',
      onHandoff: ({ at, adopt }) => dispatch({ type: 'handoff', at, adopt }),
    })
  }, [watching, handoffEngine, intent])

  // 잠금화면 · 알림 · 이어폰 단추
  const hasPrevious = Boolean(onPrevious)
  const hasNext = Boolean(onNext)
  const poster = grant.poster
  useEffect(() => {
    if (state.phase !== 'playing') return
    return bindMediaSession(typeof navigator === 'undefined' ? undefined : navigator.mediaSession, {
      title,
      poster: poster || undefined,
      media: () => (latest.current.state.mode === 'audio' ? audioRef.current : videoRef.current),
      onPrevious: hasPrevious ? () => latest.current.onPrevious?.() : undefined,
      onNext: hasNext ? () => latest.current.onNext?.() : undefined,
    })
  }, [state.phase, title, poster, hasPrevious, hasNext])

  useEffect(() => {
    if (state.phase === 'playing') latest.current.onModeChange?.(state.mode)
  }, [state.phase, state.mode])

  const press = async () => {
    if (!env) return
    // 첫 손짓 안(기다리기 전)에서 `<audio>` 를 깨워 둔다 - 나중에 화면이 꺼질 때 틀 수 있게
    if (autoAudioWhenHidden && mode === 'video' && audioOk && plan?.engine === 'native') {
      if (audioRef.current && grant.audio) wakeAudio(audioRef.current, grant.audio)
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
    setMenuOpen(false)
    if (!plan) return
    if (pick === state.pick && (pick !== 'auto' || state.kind === plan.order[0])) return
    const kind = pick === 'auto' ? plan.order[0] : pick
    dispatch({ type: 'choose', pick, kind, at: videoRef.current?.currentTime ?? 0 })
  }

  const switchMode = (next: PlayerMode) => {
    if (next === mode) return
    if (state.phase !== 'playing') {
      dispatch({ type: 'mode', mode: next, at: 0, play: false })
      return
    }
    const current = mode === 'audio' ? audioRef.current : videoRef.current
    const kind =
      next === 'video' ? (state.pick === 'auto' ? plan?.order[0] : state.pick) : undefined
    if (next === 'video' && !kind) return
    dispatch({
      type: 'mode',
      mode: next,
      kind,
      at: current?.currentTime ?? state.at,
      play: current ? !current.paused : true,
    })
  }

  const playing = state.phase === 'playing'
  const noEngine = plan !== null && plan.engine === null
  const waiting = plan !== null && plan.engine !== null && plan.order.length === 0
  const blocked = noEngine || waiting
  const ratio = grant.w > 0 && grant.h > 0 ? grant.w / grant.h : 16 / 9
  const choiceLabel = (pick: QualityChoice) =>
    pick === 'compat' ? '720p' : pick === 'orig' ? labels.original : labels.auto
  const badge = noEngine ? labels.unsupported : waiting ? labels.preparing : null
  const showVideo = playing && mode === 'video'
  const fullscreenKind = showVideo ? (env?.fullscreen ?? null) : null

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
                  aria-label={
                    grant.durationMs > 0
                      ? labels.play(formatDuration(grant.durationMs))
                      : labels.playNoLength
                  }
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
        {audioOk && (
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
            aria-label={labels.fullscreen}
            onClick={() => enterFullscreen(fullscreenKind, stageRef.current, videoRef.current)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        )}
        {showVideo && plan && plan.options.length > 1 && (
          <div
            className={styles.quality}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setMenuOpen(false)
            }}
          >
            <button
              type="button"
              className={styles.chip}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`${labels.quality}: ${choiceLabel(state.pick)}`}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {choiceLabel(state.pick)}
            </button>
            {menuOpen && (
              <div role="menu" className={styles.menu} aria-label={labels.quality}>
                {plan.options.map((option) => {
                  const off = option === 'compat' && plan.compatPending
                  return (
                    <button
                      key={option}
                      type="button"
                      role="menuitemradio"
                      className={styles.menuItem}
                      aria-checked={option === state.pick}
                      aria-disabled={off || undefined}
                      onClick={() => !off && choose(option)}
                    >
                      <span>{choiceLabel(option)}</span>
                      {off && <small>{labels.qualityPreparing}</small>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
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
