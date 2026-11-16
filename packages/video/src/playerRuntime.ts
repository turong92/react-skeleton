import { useCallback, useRef, type RefObject } from 'react'
import type { LoadHls } from './attachSource'
import type { PlaybackPlan } from './playbackPlan'
import type { PlayerMode, PlayerState } from './playerState'
import type { VideoPlayback } from './types'

/** 효과 안에서 읽는 최신 값 - 효과를 다시 걸지 않고 늘 마지막 render 의 값을 본다 */
export type Latest = {
  grant: VideoPlayback
  plan: PlaybackPlan | null
  state: PlayerState
  refreshGrant?: () => Promise<VideoPlayback>
  loadHls: LoadHls
  given: VideoPlayback
  onEnded?: () => void
  onPrevious?: () => void
  onNext?: () => void
  onModeChange?: (mode: PlayerMode) => void
  onPlayingChange?: (playing: boolean) => void
}

export type MediaRefs = {
  video: RefObject<HTMLVideoElement | null>
  audio: RefObject<HTMLAudioElement | null>
}

/** `onPlayingChange` 로 알리되 값이 바뀔 때만 - 같은 값을 거듭 보내지 않는다 */
export function usePlayingReport(latest: RefObject<Latest>) {
  const last = useRef<boolean | null>(null)
  return useCallback(
    (playing: boolean) => {
      if (last.current === playing) return
      last.current = playing
      latest.current.onPlayingChange?.(playing)
    },
    [latest],
  )
}

export type Report = ReturnType<typeof usePlayingReport>
