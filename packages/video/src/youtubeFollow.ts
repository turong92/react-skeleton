import { followSound, type FollowVideo, type SoundClock } from './videoSync'
import type { YouTubePlayer, YouTubeStates } from './youtubeApi'

/**
 * 유튜브는 재생 속도를 정해진 단계(0.25 간격)로만 바꾼다 - 따라가기가 원하는 속도(0.75~1.25 사이 0.05 단위)를 가까운 단계로.
 * 조금 어긋난 것(1.1배 이하로 고칠 만큼)은 1 로 둔다 - 단계가 커서 오히려 넘어간다
 */
export function youtubeRate(rate: number): number {
  if (rate >= 1.12) return 1.25
  if (rate <= 0.88) return 0.75
  return 1
}

/**
 * 유튜브 플레이어를 `<video>` 처럼 보이게 감싼다 - 우리 영상의 따라가기(`followSound` · `planSync`)를 그대로 쓰려고.
 * 옮기기는 `seekTo`, 속도는 `youtubeRate` 단계로, 받는 중(BUFFERING)은 옮기는 중으로 본다
 */
export function youtubeAsVideo(
  player: Pick<
    YouTubePlayer,
    | 'getCurrentTime'
    | 'getDuration'
    | 'seekTo'
    | 'playVideo'
    | 'pauseVideo'
    | 'getPlayerState'
    | 'getPlaybackRate'
    | 'setPlaybackRate'
  >,
  states: YouTubeStates,
): FollowVideo {
  const buffering = states.BUFFERING ?? 3
  const state = () => player.getPlayerState?.() ?? states.PAUSED
  return {
    get currentTime() {
      return player.getCurrentTime()
    },
    set currentTime(seconds: number) {
      player.seekTo(seconds, true)
    },
    get duration() {
      const d = player.getDuration()
      return d > 0 ? d : NaN
    },
    get paused() {
      const s = state()
      return s !== states.PLAYING && s !== buffering
    },
    get seeking() {
      return state() === buffering
    },
    // 준비(onReady)된 뒤에만 감싼다 - 길이를 알면 메타데이터가 있는 것으로
    get readyState() {
      return player.getDuration() > 0 ? 4 : 1
    },
    get playbackRate() {
      return player.getPlaybackRate?.() ?? 1
    },
    set playbackRate(rate: number) {
      const step = youtubeRate(rate)
      if ((player.getPlaybackRate?.() ?? 1) !== step) player.setPlaybackRate?.(step)
    },
    play: () => {
      player.playVideo()
      return Promise.resolve()
    },
    pause: () => player.pauseVideo(),
  } as FollowVideo
}

/** 음소거 유튜브가 소리(대기열 `<audio>`)를 따라가게 한다 - 돌려받은 함수가 멈춘다 */
export function followSoundWithYoutube(
  player: Parameters<typeof youtubeAsVideo>[0],
  states: YouTubeStates,
  sound: SoundClock,
): () => void {
  return followSound(youtubeAsVideo(player, states), sound)
}
