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
}

const finite = (n: number) => (Number.isFinite(n) && n >= 0 ? n : 0)

export function elementOutput(
  el: Pick<HTMLMediaElement, 'currentTime' | 'duration' | 'volume' | 'muted'>,
): MediaOutput {
  return {
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
    'getCurrentTime' | 'getDuration' | 'seekTo' | 'setVolume' | 'mute' | 'unMute'
  >,
): MediaOutput {
  return {
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
