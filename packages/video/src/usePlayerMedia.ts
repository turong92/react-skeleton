import { useEffect, type Dispatch } from 'react'
import { attachSource } from './attachSource'
import { handOverWhenReady } from './handOver'
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
  /** 노래 → 영상을 잇는 동안 영상을 음소거로 붙잡아 둔다(대기열이 거는 음량도 그동안은 음소거로) - `last` 는 그 사이 걸린 음량. 이 effect 가 `registerOutput` effect 보다 먼저 선언돼야 첫 음량이 붙잡힌다 */
  hush?: React.RefObject<Hush>
  bridge?: React.RefObject<Bridge>
}

/** 영상 → 소리 잇기: `toAudio` 는 재생 중에 사용자가 노래로 넘겼다는 표시, `finish` 는 아직 안 끝난 잇기를 바로 끝내는 함수 */
export type Bridge = { toAudio: boolean; finish: (() => void) | null }

function takeToAudio(bridge: React.RefObject<Bridge>): boolean {
  const was = bridge.current.toAudio
  bridge.current.toAudio = false
  return was
}

function setFinish(bridge: React.RefObject<Bridge>, finish: (() => void) | null) {
  bridge.current.finish = finish
}

export type Hush = { on: boolean; last: [volume: number, muted: boolean] | null }

function holdMute(media: HTMLMediaElement, hush: React.RefObject<Hush>) {
  hush.current.on = true
  media.muted = true
}

/** 붙잡아 둔 음소거를 풀고 그 사이 걸린 음량을 건다 */
function unhush(media: HTMLMediaElement | null, hush: React.RefObject<Hush>) {
  const was = hush.current.on
  hush.current.on = false
  if (!was || !media) return
  const [volume, muted] = hush.current.last ?? [media.volume, false]
  media.volume = volume
  media.muted = muted
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
  hush,
  bridge,
}: Args) {
  useEffect(() => {
    const { grant: g, plan: p, state: s, loadHls: load } = latest.current
    const audioMode = s.mode === 'audio'
    const media = audioMode ? refs.audio.current : refs.video.current
    const url = audioMode ? g.audio : s.kind ? urlOf(g, s.kind) : null
    if (s.phase !== 'playing' || !media || !p?.engine || !url) return
    const hosted = audioMode ? host : undefined
    // 영상으로 틀기 시작하면 대기열의 소리를 멈추고 대기열을 영상 모드로 - 소리가 나는 중이면 영상이 그 자리를 틀 수 있을 때까지 소리를 둔다(끊김 없이)
    // 영상을 다시 붙이기 전에 남은 잇기(옛 영상을 끌고 있는 것)를 끝낸다 - 같은 요소를 둘이 쥐지 않게
    if (s.mode === 'video') bridge?.current.finish?.()
    const held = hush?.current
    if (hush) unhush(null, hush)
    const handing = !audioMode && s.play && hush !== undefined && host?.status()?.playing === true
    if (!audioMode && !handing) host?.stop()
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
    /** 노래 → 영상을 잇는 중이면 그 마무리(사용자가 멈췄을 때 부른다) */
    let endHanding: (() => void) | null = null
    const onPause = () => {
      // 잇는 중(영상은 음소거로 미리 트는 중)에 온 멈춤 - 붙이며 나는 멈춤(readyState 0)은 빼고, 사용자 멈춤으로 마무리한다
      if (endHanding && media.readyState >= 2) return endHanding()
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
      const engine = p.engine
      const start = () => {
        cancelPlay = playAfterAttach(media, engine, () => report(false))
      }
      if (handing && hush) {
        // 지금(손짓 안에서) 영상을 음소거로 틀어 둔다 - 아이폰도 허락하고, 틀어야 조각을 받는다. 그동안 소리는 대기열이 낸다
        holdMute(media, hush)
        const stopPlay = playAfterAttach(media, engine, () => report(false))
        const stopWait = handOverWhenReady(
          media,
          () => host!.status()?.at ?? null,
          () => {
            endHanding = null
            // 영상이 소리 자리까지 왔다 - 영상 소리를 먼저 켜 보고(아이폰이 막으면 그 자리에서 멈춘다) 되면 대기열 소리를 끈다
            const still = host!.status()?.playing === true
            unhush(media, hush)
            if (still && media.paused) {
              // 막혔다 - 영상은 접고 나던 노래를 그대로 잇는다
              const at = host!.status()?.at ?? s.at
              dispatch({ type: 'join', at, play: true })
              return
            }
            host!.stop()
            if (!still) {
              media.pause()
              report(false)
            }
          },
        )
        endHanding = () => {
          endHanding = null
          stopWait()
          host!.stop()
          unhush(media, hush)
          report(false)
        }
        cancelPlay = () => {
          stopPlay()
          stopWait()
        }
      } else if (s.play) start()
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
      endHanding = null
      // 잇다 만 영상이 같은 요소로 다시 쓰일 수 있다(화질 · 재시도) - 붙잡은 음소거를 요소에서 푼다
      if (hush && held?.on) unhush(media as HTMLMediaElement, hush)
      const toAudio = bridge ? takeToAudio(bridge) : false
      if (hosted) {
        handle?.destroy()
        return // 소리는 대기열 것이다 - 이 재생기가 사라져도 이어진다
      }
      const release = () => {
        handle?.destroy()
        media.pause()
        if (!audioMode) {
          // 떼어 낸 영상이 조각을 계속 받지 않게(소리 `<audio>` 는 깨워 둔 채로 남긴다)
          media.removeAttribute('src')
          media.load()
        }
      }
      const sound = host?.element()
      if (audioMode || !toAudio || !bridge || !sound || media.paused) return release()
      // 영상 → 노래: 숨긴 영상이 계속 소리를 내는 동안 대기열 소리를 음소거로 붙여, 영상 자리까지 받으면 그 자리로 옮겨 소리를 켜고 영상을 멈춘다
      sound.muted = true
      let seekLimit: ReturnType<typeof setTimeout> | undefined
      const finish = () => {
        setFinish(bridge, null)
        stopWait()
        clearTimeout(seekLimit)
        sound.removeEventListener('seeked', finish)
        sound.removeEventListener('emptied', reloaded)
        sound.removeEventListener('loadeddata', loaded)
        sound.removeEventListener('pause', userPaused)
        sound.removeEventListener('seeking', userSeeked)
        sound.removeEventListener('volumechange', userVolume)
        document.removeEventListener('visibilitychange', hidden)
        // 그 사이 사용자가 바꾼 것까지 대기열의 지금 음량 · 음소거로 되돌린다
        const { volume, muted } = host!.levels()
        sound.volume = volume
        sound.muted = muted
        release()
      }
      // 잇는 사이 사용자 조작은 대기열 <audio> 에만 걸린다 - 걸리는 즉시 잇기를 끝내 실제 소리가 그 조작을 따르게 한다
      const userPaused = () => {
        if (sound.readyState >= 2) finish() // 붙이며 나는 멈춤(readyState 0)은 빼고
      }
      const userSeeked = () => {
        if (Math.abs(sound.currentTime - media.currentTime) > 3) finish() // 우리가 영상 근처로 옮기는 것(붙일 때 · 맞출 때)은 빼고
      }
      const userVolume = () => {
        if (!sound.muted) finish() // 음량을 만지면 대기열이 음소거를 푼다
      }
      // 화면이 꺼지면 아이폰이 숨긴 영상을 멈춘다 - 그 순간(이벤트 안에서) 노래로 넘긴다
      const hidden = () => {
        if (document.visibilityState === 'hidden') finish()
      }
      sound.addEventListener('pause', userPaused)
      sound.addEventListener('seeking', userSeeked)
      sound.addEventListener('volumechange', userVolume)
      // 곡이 바뀌어 다시 붙였다 - 이 잇기가 붙이며 나는 비움(아직 못 불러옴)은 빼고
      let ready = false
      const loaded = () => {
        ready = true
      }
      const reloaded = () => {
        if (ready) finish()
      }
      sound.addEventListener('loadeddata', loaded)
      sound.addEventListener('emptied', reloaded)
      document.addEventListener('visibilitychange', hidden)
      const stopWait = handOverWhenReady(
        sound,
        () => (media.paused ? null : media.currentTime),
        () => {
          // 옮긴 자리를 틀 준비가 되면 바꾼다(옮기는 중이면 끝날 때, 길어도 1 초)
          if (!sound.seeking) return finish()
          sound.addEventListener('seeked', finish, { once: true })
          seekLimit = setTimeout(finish, 1000)
        },
        { timeoutMs: 4000 },
      )
      setFinish(bridge, finish)
    }
    // `latest` · `refs` · `dispatch` 는 늘 같은 것이다 - 걸음이 바뀔 때(session)만 다시 붙인다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, intent, ready])
  // 재생기가 사라질 때(곡 넘김 · 큰 화면 닫기) 남은 잇기를 끝낸다
  useEffect(() => () => bridge?.current.finish?.(), [bridge])
}
