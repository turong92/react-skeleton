import { useEffect, type Dispatch } from 'react'
import { attachSource } from './attachSource'
import { OS_PAUSE_WINDOW_MS, type PlayIntent } from './playIntent'
import { afterFailure, urlOf } from './playbackPlan'
import type { Latest, MediaRefs, Report } from './playerRuntime'
import { momentOf, type PlayerAction } from './playerState'
import type { VideoPlayback } from './types'

type Args = {
  latest: React.RefObject<Latest>
  refs: MediaRefs
  intent: PlayIntent
  report: Report
  dispatch: Dispatch<PlayerAction>
  setFresh: (fresh: { from: VideoPlayback; value: VideoPlayback }) => void
  session: number
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
}: Args) {
  useEffect(() => {
    const { grant: g, plan: p, state: s, loadHls: load } = latest.current
    const audioMode = s.mode === 'audio'
    const media = audioMode ? refs.audio.current : refs.video.current
    const url = audioMode ? g.audio : s.kind ? urlOf(g, s.kind) : null
    if (s.phase !== 'playing' || !media || !p?.engine || !url) return
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
        if (audioMode && back) dispatch({ type: 'audioFailed', kind: back, at, play: s.play })
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
    const onPause = () => {
      intent.pause()
      pausedTimer = setTimeout(() => report(false), OS_PAUSE_WINDOW_MS)
    }
    const onEnd = () => {
      clearTimeout(pausedTimer)
      intent.ended()
      report(false)
      latest.current.onEnded?.()
    }
    media.addEventListener('play', onPlay)
    media.addEventListener('pause', onPause)
    media.addEventListener('ended', onEnd)
    media.addEventListener('error', fail)
    let handle: { destroy: () => void } | null = null
    if (s.adopt) {
      // 화면이 꺼지는 순간 `<audio>` 가 이미 틀기 시작했다 - 다시 붙이면 끊긴다
      if (!media.paused) {
        intent.play()
        report(true)
      }
    } else {
      handle = attachSource(media, url, p.engine, { loadHls: load, onFatal: fail, startAt: s.at })
      if (s.play) void media.play()?.catch(() => {})
      else report(false)
    }
    return () => {
      clearTimeout(pausedTimer)
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
    // `latest` · `refs` · `dispatch` 는 늘 같은 것이다 - 걸음이 바뀔 때(session)만 다시 붙인다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, intent])
}
