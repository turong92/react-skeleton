import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { wakeAudio } from './autoAudio'
import { readBrowserEnv } from './browserEnv'
import { leaveFullscreenOf, toggleFullscreen } from './fullscreen'
import { defaultVideoPlayerLabels } from './labels'
import { loadHlsLight } from './loadHls'
import { FullscreenButton } from './FullscreenButton'
import { pictureStep } from './followedPicture'
import { PictureFailed, TapToWatch } from './PictureNotices'
import { elementOutput } from './mediaOutput'
import { ModePill } from './ModePill'
import { firstStep, grantExpired, planPlayback, type QualityChoice } from './playbackPlan'
import { createPlayIntent } from './playIntent'
import { usePlayingReport, type Latest } from './playerRuntime'
import { playbackOf, type PlayerSource } from './playerSource'
import {
  followPlayback,
  initialPlayer,
  momentOf,
  qualityChoosable,
  reducePlayer,
  type PlayerMode,
} from './playerState'
import { QualityMenu } from './QualityMenu'
import { heightOfSize } from './qualityLabel'
import type { QualityHandle, QualityOption } from './queueController'
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
 * 소리 판이 실패하면 안내 한 줄과 함께 영상으로 되돌아온다. 잠금화면 단추(Media Session) · 전체 화면 단추가 붙는다.
 * 대기열(`audioHost`)에 붙은 소리 판 있는 곡은 다르다 - 소리는 늘 대기열의 `<audio>` 가 내고, 영상 모드(`queueMode`)는 그 위에 **음소거 영상**만
 * 붙여 소리 시각을 따라가게 한다(노래 모드는 영상을 떼기만 한다). 소리를 넘겨주는 일이 없어 모드를 바꿔도 소리가 끊기지 않는다
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
  followPlaying,
  audioHost,
  controls = true,
  modeToggle = true,
  queueMode,
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
  // 소리는 대기열 `<audio>` 가 내고 이 재생기는 그 위에 음소거 영상을 붙일 뿐이다
  const followed = audioHost !== undefined && audioOk

  const [state, dispatch] = useReducer(reducePlayer, null, () => ({
    ...initialPlayer,
    mode: initialMode,
  }))
  const mode: PlayerMode = audioOk ? state.mode : 'video'
  // 알약 · 안내에 보이는 모드 - 대기열이 정한 것을 곧바로(영상은 아직 붙는 중이어도)
  const shownMode: PlayerMode = followed ? (queueMode ?? 'audio') : mode
  const playing = state.phase === 'playing'
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const refs = { video: videoRef, audio: audioRef }
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
  // 음소거 영상이 소리 자리의 프레임을 가질 때까지는 멈춘 첫 화면 대신 포스터를 보인다
  const [synced, setSynced] = useState(false)
  // 브라우저가 음소거 영상의 재생을 막았다(저전력 모드) - 누르면 영상을 튼다
  const [tap, setTap] = useState<{ resume: () => void } | null>(null)
  const follow = useMemo(
    () =>
      followed && audioHost
        ? {
            sound: {
              position: () => audioHost.status()?.at ?? 0,
              playing: () => audioHost.status()?.playing === true,
            },
            onSynced: setSynced,
            onBlocked: (resume: (() => void) | null) => setTap(resume ? { resume } : null),
          }
        : undefined,
    [followed, audioHost],
  )
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
    follow,
  })
  useHiddenHandoff({
    // 소리 판 실패로 영상에 돌아온 직후(notice)에는 다시 넘기지 않는다. 대기열에 붙은 곡은 소리가 이미 대기열이라 넘길 것이 없다
    // (화면이 꺼지면 대기열이 모드를 노래로 바꿔 영상을 뗀다)
    watching:
      autoAudioWhenHidden && playing && mode === 'video' && audioOk && !state.notice && !audioHost,
    engine: plan?.engine,
    latest,
    refs,
    intent,
    report,
    dispatch,
  })
  useLockScreen({
    // 대기열이 소리를 쥐고 있으면 잠금화면은 대기열이 묶는다
    playing: playing && !followed,
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

  // 소리 판 없는 영상의 <video> 를 대기열에 등록한다 - 진행 막대 · 음량이 노래 · 유튜브와 같은 손잡이로 이 요소를 다룬다(요소가 새로 생기면 지금 음량이 걸린다).
  // 소리 판이 있는 곡은 아니다 - 진행 막대 · 음량은 대기열 `<audio>` 것이고 영상은 늘 음소거다
  const showingVideo = playing && mode === 'video' && !followed
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
    // 첫 손짓 안(기다리기 전)에서 `<audio>` 를 깨워 둔다 - 나중에 화면이 꺼질 때 틀 수 있게(대기열에 붙은 곡은 대기열이 깨운다)
    if (
      autoAudioWhenHidden &&
      !audioHost &&
      mode === 'video' &&
      audioOk &&
      plan?.engine === 'native' &&
      audioRef.current &&
      grant.audio
    )
      wakeAudio(audioRef.current, grant.audio)
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
    const first = firstStep(planPlayback(g, env), state.pick)
    if (first) dispatch({ type: 'press', kind: first, mode: followed ? 'video' : mode })
  }

  // 대기열이 이 곡을 영상으로 틀라고 한다(다음 곡으로 넘어옴 · 한 곡 반복 · 다시 틀기) - 신호가 바뀔 때마다 처음부터
  const startedFor = useRef<number | null | undefined>(autoStart ? null : startSignal)
  useEffect(() => {
    // 소리 판이 있는 곡은 시작 신호가 아니라 대기열의 모드를 따라 영상을 붙인다(아래)
    if (
      followed ||
      !autoStart ||
      startSignal === undefined ||
      !env ||
      startedFor.current === startSignal
    )
      return
    startedFor.current = startSignal
    void press()
    // `press` 는 이 렌더의 값을 쓴다 - 신호 · 환경이 바뀔 때만 건다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, startSignal, env])

  // 영상을 못 틀어도 대기열은 다음 곡으로 가지 않는다 - 소리 판이 있는 곡은 소리가 멀쩡하다
  useEffect(() => {
    if (state.phase === 'failed' && !followed) latest.current.onFailed?.()
  }, [state.phase, followed])

  // 대기열이 영상 모드면 음소거 영상을 붙이고, 노래 모드면 뗀다(소리는 그대로) - 화면이 꺼지거나 큰 화면이 닫혀도 대기열이 모드를 노래로 바꾼다
  const pictureWanted = followed && queueMode === 'video'
  useEffect(() => {
    if (!followed) return
    const step = pictureStep({
      pictureWanted,
      phase: latest.current.state.phase,
      mode: latest.current.state.mode,
    })
    if (step === 'attach') void press()
    else if (step === 'detach') dispatch({ type: 'mode', mode: 'audio', at: 0, play: false })
    // `press` 는 이 렌더의 값을 쓴다 - 모드 · 환경이 바뀔 때만 건다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followed, pictureWanted, env])

  // 소리 판 없는 영상은 대기열의 재생 · 멈춤을 영상이 따른다(작은 재생기 · 잠금화면). 소리 판이 있는 곡은 영상이 소리를 따라간다(usePlayerMedia)
  useEffect(() => {
    const video = refs.video.current
    if (!video || followed || state.phase !== 'playing' || mode !== 'video') return
    const todo = followPlayback(video.paused, followPlaying)
    if (todo === 'pause') video.pause()
    else if (todo === 'play') void video.play()?.catch(() => report(false))
    // 대기열의 재생 상태가 바뀔 때만 건다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followPlaying])

  const choose = (pick: QualityChoice) => {
    if (!plan) return
    // 호환 단이 아직 없다(준비 중) - 칩은 막아 두지만 앱 조작줄(`setQuality`)이 불러도 없는 주소를 틀지 않는다
    if (pick === 'compat' && plan.compatPending) return
    if (pick === state.pick && (pick !== 'auto' || state.kind === plan.order[0])) return
    // 아직 안 틀었으면(또는 실패 뒤) 고른 값만 기억한다 - 첫 재생이 그 단으로 시작한다
    if (state.phase !== 'playing') return dispatch({ type: 'pick', pick })
    const kind = pick === 'auto' ? plan.order[0] : pick
    const video = videoRef.current
    // 멈춰 있으면 같은 시각에 붙이되 멈춘 채로
    dispatch({
      type: 'choose',
      pick,
      kind,
      at: video?.currentTime ?? 0,
      play: video ? !video.paused : true,
    })
  }

  const switchMode = (next: PlayerMode) => {
    // 대기열에 붙은 곡 - 선호만 정한다(소리는 건드리지 않고, 영상은 대기열이 모드를 바꾸면 붙거나 떨어진다)
    if (followed && audioHost) return audioHost.setPreferred(next)
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
  // 화질 선택지 - 이름은 실제 높이(원본 = 원본 크기의 짧은 변, 호환 단 = `source.compatHeight` · 서버 허가는 720). 모르면 null
  const origHeight = heightOfSize(grant.w, grant.h)
  const compatHeight = source ? (source.compatHeight ?? null) : 720
  // `plan` 은 렌더마다 새로 만들어진다 - 값(이름 목록)이 같으면 같은 배열을 쓴다(아래 등록 효과가 렌더마다 다시 돌아 대기열을 다시 그리게 하지 않도록)
  const optionKey = plan?.options.join(',') ?? ''
  const compatPending = plan?.compatPending ?? false
  const qualityOptions = useMemo<QualityOption[]>(
    () =>
      (optionKey ? (optionKey.split(',') as QualityChoice[]) : []).map((value) => ({
        value,
        height: value === 'compat' ? compatHeight : value === 'orig' ? origHeight : null,
        ...(value === 'compat' && compatPending ? { pending: true } : {}),
      })),
    [optionKey, compatHeight, origHeight, compatPending],
  )
  // 지금 실제로 나오는 높이 - 메타데이터 · 크기 변화(hls.js 의 단 바뀜)마다 `videoHeight` 로 읽는다
  const [playingHeight, setPlayingHeight] = useState<number | null>(null)
  useEffect(() => {
    const video = videoRef.current
    if (!showVideo || !video) return setPlayingHeight(null)
    const read = () => setPlayingHeight(heightOfSize(video.videoWidth, video.videoHeight))
    read()
    video.addEventListener('loadedmetadata', read)
    video.addEventListener('resize', read)
    return () => {
      video.removeEventListener('loadedmetadata', read)
      video.removeEventListener('resize', read)
    }
  }, [showVideo, state.session])
  // 대기열(앱 조작줄)에 화질을 등록한다 - 영상으로 보일 때 · 고를 것이 둘 이상일 때만
  const chooseRef = useRef(choose)
  useEffect(() => {
    chooseRef.current = choose
  })
  // 영상 모드로 정해져 있으면 멈춘 채 · 시작 전에도 내준다(앱의 화질 단추 · 유튜브 뮤직처럼) - 노래 모드는 아니다
  const choosable = qualityChoosable({
    showVideo,
    mode,
    queueMode,
    options: qualityOptions.length,
  })
  const qualityHandle = useRef<QualityHandle | null>(null)
  useEffect(() => {
    if (!choosable || !audioHost) return
    const handle = audioHost.quality.register({
      options: qualityOptions,
      value: state.pick,
      set: (quality) => chooseRef.current(quality),
    })
    qualityHandle.current = handle
    handle.reportHeight(playingHeight) // 다시 등록돼도 지금 높이를 다시 알린다(같은 높이 단이면 이벤트가 안 온다)
    return () => {
      handle.release()
      qualityHandle.current = null
    }
    // 높이는 아래 효과가 이어서 알린다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choosable, audioHost, qualityOptions, state.pick])
  useEffect(() => {
    qualityHandle.current?.reportHeight(playingHeight)
  }, [playingHeight])

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
    shownMode === 'audio'
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
        {/* 소리 모드에서도 요소는 남긴다(숨김) - 「영상」을 누르는 손짓 안에서 깨워 둘 요소가 있어야 아이폰이 나중 재생을 막지 않는다 */}
        <video
          ref={videoRef}
          hidden={!showVideo}
          className={styles.video}
          poster={grant.poster || undefined}
          controls={controls && !followed}
          playsInline
          preload="auto"
          controlsList="nodownload"
          aria-label={labels.video}
        />
        {/* 음소거 영상이 소리 자리의 프레임을 갖기 전까지는 포스터로 덮는다(아이폰은 숨긴 영상을 돌리지 않아 숨기지 않고 덮는다) */}
        {showVideo && followed && !synced && grant.poster && (
          <img className={[styles.poster, styles.hushCover].join(' ')} src={grant.poster} alt="" />
        )}
        {showVideo && followed && tap && <TapToWatch labels={labels} onClick={tap.resume} />}
        {!showVideo && (
          <>
            {grant.poster && <img className={styles.poster} src={grant.poster} alt="" />}
            {/* 대기열에 붙은 곡은 재생 단추가 없다 - 틀고 멈추는 것은 대기열(앱 조작줄)이 한다 */}
            {!playing && !followed && (
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
        {showVideo && controls && plan && plan.options.length > 1 && (
          <QualityMenu
            options={qualityOptions}
            pick={state.pick}
            playingHeight={playingHeight}
            labels={labels}
            onChoose={choose}
          />
        )}
      </div>
      {audioOk && modeToggle && (
        <div className={styles.mode}>
          <ModePill labels={labels} mode={shownMode} onChange={switchMode} />
        </div>
      )}
      {state.notice && (
        <p role="status" className={styles.note}>
          {labels.audioFailed}
        </p>
      )}
      {state.phase === 'failed' && !followed && (
        <p role="alert" className={styles.problem}>
          {labels.failed}
        </p>
      )}
      {state.phase === 'failed' && followed && pictureWanted && (
        <PictureFailed labels={labels} onRetry={() => void press()} />
      )}
    </div>
  )
}
