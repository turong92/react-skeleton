import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { attachSource, type LoadHls } from './attachSource'
import { defaultVideoPlayerLabels, type VideoPlayerLabels } from './labels'
import { loadHlsLight } from './loadHls'
import {
  afterFailure,
  grantExpired,
  planPlayback,
  urlOf,
  type PlaybackEnv,
  type QualityChoice,
} from './playbackPlan'
import { initialPlayer, reducePlayer } from './playerState'
import type { VideoPlayback } from './types'
import styles from './VideoPlayer.module.css'
import { formatDuration } from './videoView'

export type VideoPlayerProps = {
  /** `api.playback(id)` 의 응답 */
  grant: VideoPlayback
  /**
   * 비공개 영상은 토큰이 끝나면 조각을 못 받는다 - 새 재생 허가(`api.playback(id)`)를 받아 오는 함수를 주면
   * 끝난 것을 알아챈 순간 새 허가로 **같은 시각에서** 이어 보인다. 공개 영상은 필요 없다
   */
  refreshGrant?: () => Promise<VideoPlayback>
  labels?: VideoPlayerLabels
  className?: string
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
  browserEnv = {
    canPlayType: (mime) =>
      typeof probe.canPlayType === 'function' && Boolean(probe.canPlayType(mime)),
    mse:
      mse && typeof mse.isTypeSupported === 'function'
        ? { isTypeSupported: (t) => mse.isTypeSupported!(t) }
        : null,
  }
  return browserEnv
}

const subscribeNothing = () => () => {}
const serverEnv = () => null

/**
 * 영상 재생 - 포스터 + 재생 단추(누르기 전에는 영상 파일도 hls.js 도 받지 않는다). 순서는 마스터 → 원본 단 → 호환 단이고
 * 틀지 못하면 다음 순서로 같은 시각에서 넘어간다. 네이티브 HLS 가 없으면 hls.js light 를 누를 때 불러온다.
 * 판이 둘 이상이면 화질 칩(자동 / 720p / 원본)이 뜨고, 바꿔도 시각을 잇는다. 내려받기 단추는 없다
 */
export function VideoPlayer({
  grant: given,
  refreshGrant,
  labels = defaultVideoPlayerLabels,
  className,
  env: envProp,
  loadHls = loadHlsLight,
}: VideoPlayerProps) {
  const [fresh, setFresh] = useState<{ from: VideoPlayback; value: VideoPlayback } | null>(null)
  const grant = fresh && fresh.from.src === given.src ? fresh.value : given
  // 서버(와 첫 하이드레이션)에서는 모른다 - 아는 순간 한 번 다시 그린다
  const deviceEnv = useSyncExternalStore(subscribeNothing, readBrowserEnv, serverEnv)
  const env = envProp ?? deviceEnv
  const plan = env ? planPlayback(grant, env) : null

  const [state, dispatch] = useReducer(reducePlayer, initialPlayer)
  const [menuOpen, setMenuOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const latest = useRef({ grant, plan, state, refreshGrant, loadHls, given })
  useEffect(() => {
    latest.current = { grant, plan, state, refreshGrant, loadHls, given }
  })

  useEffect(() => {
    const video = videoRef.current
    const { grant: g, plan: p, state: s, loadHls: load } = latest.current
    if (s.phase !== 'playing' || !video || !p?.engine || !s.kind) return
    let settled = false
    const fail = () => {
      if (settled) return
      settled = true
      const now = latest.current
      const at = video.currentTime
      const decision = afterFailure({
        grant: now.grant,
        order: now.plan?.order ?? [],
        tried: now.state.tried,
        now: Date.now(),
        canRefresh: Boolean(now.refreshGrant),
        refreshed: now.state.refreshed,
      })
      if (decision.action === 'next') dispatch({ type: 'next', kind: decision.kind, at })
      else if (decision.action === 'give-up') dispatch({ type: 'giveUp' })
      else
        now.refreshGrant!().then(
          (value) => {
            setFresh({ from: now.given, value })
            dispatch({ type: 'refresh', at })
          },
          () => dispatch({ type: 'giveUp' }),
        )
    }
    const handle = attachSource(video, urlOf(g, s.kind), p.engine, {
      loadHls: load,
      onFatal: fail,
      startAt: s.at,
    })
    video.addEventListener('error', fail)
    void video.play()?.catch(() => {})
    return () => {
      handle.destroy()
      video.removeEventListener('error', fail)
    }
  }, [state.session])

  const press = async () => {
    if (!env) return
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
    if (first) dispatch({ type: 'press', kind: first })
  }

  const choose = (pick: QualityChoice) => {
    setMenuOpen(false)
    if (!plan) return
    if (pick === state.pick && (pick !== 'auto' || state.kind === plan.order[0])) return
    const kind = pick === 'auto' ? plan.order[0] : pick
    dispatch({ type: 'choose', pick, kind, at: videoRef.current?.currentTime ?? 0 })
  }

  const playing = state.phase === 'playing'
  const noEngine = plan !== null && plan.engine === null
  const waiting = plan !== null && plan.engine !== null && plan.order.length === 0
  const blocked = noEngine || waiting
  const ratio = grant.w > 0 && grant.h > 0 ? grant.w / grant.h : 16 / 9
  const choiceLabel = (pick: QualityChoice) =>
    pick === 'compat' ? '720p' : pick === 'orig' ? labels.original : labels.auto
  const badge = noEngine ? labels.unsupported : waiting ? labels.preparing : null

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div
        className={styles.stage}
        style={{
          aspectRatio: `${grant.w || 16}/${grant.h || 9}`,
          maxInlineSize: `min(100%, calc(80vh * ${ratio}))`,
        }}
      >
        {playing ? (
          <video
            ref={videoRef}
            className={styles.video}
            poster={grant.poster}
            controls
            playsInline
            preload="auto"
            controlsList="nodownload"
            aria-label={labels.video}
          />
        ) : (
          <>
            <img className={styles.poster} src={grant.poster} alt="" />
            <div className={styles.cover}>
              <button
                type="button"
                className={styles.play}
                aria-label={labels.play(formatDuration(grant.durationMs))}
                disabled={blocked}
                onClick={press}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          </>
        )}
        {badge && (
          <p className={styles.badge} role="status">
            {badge}
          </p>
        )}
        {playing && plan && plan.options.length > 1 && (
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
      {state.phase === 'failed' && (
        <p role="alert" className={styles.problem}>
          {labels.failed}
        </p>
      )}
    </div>
  )
}
