import { applySink } from './outputDevice'
import type { YouTubePlayer } from './youtubeApi'

/**
 * 지금 화면에서 소리를 내는 것(영상 `<video>` · 유튜브 플레이어)을 대기열이 같은 방식으로 다루는 손잡이 -
 * 진행 막대(시각 · 길이 · 옮기기)와 음량이 이것 하나로 세 종류(대기열 `<audio>` · 영상 · 유튜브)를 가린다
 */
export type MediaOutput = {
  /** 지금 시각과 길이(초) - 길이를 모르면(NaN · 라이브) 0 */
  read: () => { currentTime: number; duration: number }
  seek: (seconds: number) => void
  /** `volume` 0~1 */
  applyVolume: (volume: number, muted: boolean) => void
  /** 자막 켜고 끄기 - 자막을 다룰 수 있는 출력(유튜브)만 */
  setCaptions?: (on: boolean) => void
  /** 소리 나올 장치 고르기(빈 값 = 기본) - 장치를 고를 수 있는 출력(`<video>`)만. 유튜브 틀은 못 한다 */
  setSink?: (id: string) => void
}

const finite = (n: number) => (Number.isFinite(n) && n >= 0 ? n : 0)

export function elementOutput(
  el: Pick<HTMLMediaElement, 'currentTime' | 'duration' | 'volume' | 'muted'> &
    Partial<Pick<HTMLMediaElement, 'setSinkId'>>,
): MediaOutput {
  return {
    setSink: (id) => applySink(el, id),
    read: () => ({ currentTime: finite(el.currentTime), duration: finite(el.duration) }),
    seek: (seconds) => {
      el.currentTime = seconds
    },
    applyVolume: (volume, muted) => {
      el.volume = volume
      el.muted = muted
    },
  }
}

export function youtubeOutput(
  player: Pick<
    YouTubePlayer,
    | 'getCurrentTime'
    | 'getDuration'
    | 'seekTo'
    | 'setVolume'
    | 'mute'
    | 'unMute'
    | 'loadModule'
    | 'unloadModule'
  >,
): MediaOutput & { reapplyCaptions: () => void } {
  // 유튜브는 재생이 시작될 때 자막 모듈을 (영상 · 계정 설정대로) 다시 올린다 - 원하는 값을 기억했다가 재생이 시작되면 다시 건다
  let captions: boolean | null = null
  const applyCaptions = () => {
    if (captions === null) return
    if (captions) player.loadModule?.('captions')
    else {
      // 옛 이름(cc)으로 올라오는 경우도 같이 내린다
      player.unloadModule?.('captions')
      player.unloadModule?.('cc')
    }
  }
  return {
    setCaptions: (on) => {
      captions = on
      applyCaptions()
    },
    reapplyCaptions: applyCaptions,
    read: () => ({
      currentTime: finite(player.getCurrentTime()),
      duration: finite(player.getDuration()),
    }),
    seek: (seconds) => player.seekTo(seconds, true),
    applyVolume: (volume, muted) => {
      player.setVolume(Math.round(volume * 100))
      if (muted) player.mute()
      else player.unMute()
    },
  }
}

/** 0.5 를 넣고 다시 읽어 0.5 가 아니면 이 기기는 코드로 음량을 못 바꾼다(아이폰: `volume` 이 읽기 전용, 기기 단추만) */
export function canSetVolumeOf(el: { volume: number }): boolean {
  try {
    el.volume = 0.5
    return el.volume === 0.5
  } catch {
    return false
  }
}

let canSetVolume: boolean | undefined

/** 떼어 둔 `<audio>` 로 한 번만 잰다 - 서버에서는 부르지 않는다(`useSyncExternalStore` 의 서버 값은 false) */
export function readCanSetVolume(): boolean {
  canSetVolume ??= canSetVolumeOf(document.createElement('audio'))
  return canSetVolume
}
