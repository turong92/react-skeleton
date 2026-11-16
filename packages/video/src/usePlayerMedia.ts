import { useEffect, type Dispatch } from 'react'
import { attachSource } from './attachSource'
import { playAfterAttach } from './playAfterAttach'
import { watchInput } from './lastInput'
import { OS_PAUSE_WINDOW_MS, type PlayIntent } from './playIntent'
import { afterFailure, urlOf } from './playbackPlan'
import type { Latest, MediaRefs, Report } from './playerRuntime'
import { momentOf, type PlayerAction } from './playerState'
import type { AudioHost } from './queueController'
import type { VideoPlayback } from './types'

type Args = {
  latest: React.RefObject<Latest>
  refs: MediaRefs
  intent: PlayIntent
  report: Report
  dispatch: Dispatch<PlayerAction>
  setFresh: (fresh: { from: VideoPlayback; value: VideoPlayback }) => void
  session: number
  /** 이 기기가 HLS 를 틀 수 있다는 것을 알았다(서버 렌더 뒤 하이드레이션) - 그때 다시 붙인다 */
  ready: boolean
  /** 대기열의 `<audio>` - 있으면 소리 모드는 거기에 붙이고(걷지 않는다) 곡이 끝나거나 틀리는 것은 대기열이 맡는다 */
  host?: AudioHost
}

/**
 * 걸음 · 모드 · 허가가 바뀔 때마다(`session`) 요소(영상 또는 소리)에 재생 목록을 다시 붙인다.
 * 못 틀면 같은 시각에서 다음 걸음 · 새 허가 · (소리 판이면) 영상으로 되돌아간다. 재생 · 멈춤 · 끝 이벤트를 의도 추적과 앱 알림에 잇는다
 */
export function usePlayerMedia({
  latest,
  refs,
  intent,
  report,
  dispatch,
  setFresh,
  session,
  ready,
  host,
}: Args) {
  useEffect(() => {
    const { grant: g, plan: p, state: s, loadHls: load } = latest.current
    const audioMode = s.mode === 'audio'
    const media = audioMode ? refs.audio.current : refs.video.current
    const url = audioMode ? g.audio : s.kind ? urlOf(g, s.kind) : null
    if (s.phase !== 'playing' || !media || !p?.engine || !url) return
    const hosted = audioMode ? host : undefined
    // 영상으로 틀기 시작하면 대기열의 소리를 멈추고 대기열을 영상 모드로
    if (!audioMode) host?.stop()
    let settled = false
    const fail = () => {
      if (settled) return
      settled = true
      const now = latest.current
      const at = momentOf(media, s.at)
      const order = now.plan?.order ?? []
      const decision = afterFailure({
        grant: now.grant,
        order: audioMode ? [] : order,
        tried: audioMode ? [] : now.state.tried,
        now: Date.now(),
        canRefresh: Boolean(now.refreshGrant),
        refreshed: now.state.refreshed,
      })
      if (decision.action === 'next') dispatch({ type: 'next', kind: decision.kind, at })
      else if (decision.action === 'give-up') {
        // 소리 판이 안 되면 고른 화질의 영상 걸음에서 같은 시각 · 같은 재생 상태로
        const pick = now.state.pick
        const back = pick === 'auto' || !order.includes(pick) ? order[0] : pick
        if (audioMode && back)
          dispatch({ type: 'audioFailed', kind: back, at, play: intent.wasPlaying() || s.play })
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
    // OS 가 화면을 끄며 멈춘 것은 앱에 「멈췄다」고 알리지 않는다 - 잠깐 기다려 자동 전환이 이어받는지 본다
    let pausedTimer: ReturnType<typeof setTimeout> | undefined
    const onPlay = () => {
      clearTimeout(pausedTimer)
      intent.play()
      report(true)
    }
    const input = watchInput(document)
    let cancelPlay = () => {}
    const onPause = () => {
      cancelPlay() // 붙이는 사이에 멈췄다(사용자 · 잠금화면 · 대기열) - 메타데이터가 와도 다시 틀지 않는다
      // 방금 실제 입력(화면 · 키)이 있었다면 사용자가 누른 멈춤 - OS 가 잠그며 건 것은 입력 없이 온다
      const touching = input.recent()
      intent.pause(touching)
      // 화면을 만지는 중의 멈춤은 사용자 것 - 바로 알린다. 아니면 OS 가 한 것일 수 있어 자동 전환이 이어받는지 본다
      if (touching) report(false)
      else pausedTimer = setTimeout(() => report(false), OS_PAUSE_WINDOW_MS)
    }
    const onEnd = () => {
      clearTimeout(pausedTimer)
      intent.ended()
      report(false)
      latest.current.onEnded?.()
    }
    media.addEventListener('play', onPlay)
    media.addEventListener('pause', onPause)
    if (!hosted) {
      media.addEventListener('ended', onEnd)
      media.addEventListener('error', fail)
    }
    let handle: { destroy: () => void } | null = null
    if (hosted) hosted.start({ url, at: s.at, play: s.play, adopt: s.adopt })
    if (s.adopt) {
      // 화면이 꺼지는 순간 `<audio>` 가 이미 틀기 시작했다 - 다시 붙이면 끊긴다
      if (!media.paused) {
        intent.play()
        report(true)
      }
    } else if (hosted) {
      if (!s.play) report(false)
    } else {
      handle = attachSource(media, url, p.engine, { loadHls: load, onFatal: fail, startAt: s.at })
      if (s.play) cancelPlay = playAfterAttach(media, p.engine, () => report(false))
      else report(false)
    }
    return () => {
      clearTimeout(pausedTimer)
      cancelPlay()
      input.stop()
      media.removeEventListener('play', onPlay)
      media.removeEventListener('pause', onPause)
      media.removeEventListener('ended', onEnd)
      media.removeEventListener('error', fail)
      handle?.destroy()
      if (hosted) return // 소리는 대기열 것이다 - 이 재생기가 사라져도 이어진다
      media.pause()
      if (!audioMode) {
        // 떼어 낸 영상이 조각을 계속 받지 않게(소리 `<audio>` 는 깨워 둔 채로 남긴다)
        media.removeAttribute('src')
        media.load()
      }
    }
    // `latest` · `refs` · `dispatch` 는 늘 같은 것이다 - 걸음이 바뀔 때(session)만 다시 붙인다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, intent, ready])
}
