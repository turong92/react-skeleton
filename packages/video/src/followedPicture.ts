import { attachSource, type LoadHls } from './attachSource'
import type { PlayerMode, PlayerState } from './playerState'
import { followSound, type SoundClock } from './videoSync'

/** 음소거 영상을 소리보다 이만큼(초) 앞에서 붙인다 - 조각을 받는 동안 소리가 그만큼 흐른다 */
const START_LEAD = 1

/**
 * 소리를 대기열 `<audio>` 가 내는 곡에서, 대기열 모드가 바뀔 때 영상으로 할 일 -
 * 영상 모드면 붙이고(실패한 뒤에도 다시), 노래 모드로 바뀌면 틀고 있던 영상만 뗀다. 소리는 어느 쪽이든 그대로다
 */
export function pictureStep(input: {
  pictureWanted: boolean
  phase: PlayerState['phase']
  mode: PlayerMode
}): 'attach' | 'detach' | null {
  if (input.pictureWanted) return 'attach'
  return input.phase === 'playing' && input.mode === 'video' ? 'detach' : null
}

type Media = Parameters<typeof followSound>[0] &
  Parameters<typeof attachSource>[0] &
  Pick<HTMLMediaElement, 'muted' | 'removeAttribute' | 'load'>

/**
 * 음소거 영상을 소리 시각(+ 받는 동안 흐를 만큼)에서 붙이고 그 뒤로는 소리를 따라가게 한다(재생 · 멈춤 · 끝을 앱에 알리지 않는다 -
 * 소리는 대기열이 쥔다). 돌려받은 함수가 떼어 낸다 - 영상이 조각을 계속 받지 않게 파일을 비운다
 */
export function attachFollowedPicture(
  media: Media,
  url: string,
  engine: 'native' | 'hlsjs',
  {
    loadHls,
    sound,
    onFatal,
    onSynced,
    onBlocked,
  }: {
    loadHls: LoadHls
    sound: SoundClock
    onFatal: () => void
    onSynced: (synced: boolean) => void
    onBlocked: (resume: (() => void) | null) => void
  },
): () => void {
  media.muted = true
  const handle = attachSource(media, url, engine, {
    loadHls,
    onFatal,
    startAt: sound.position() + (sound.playing() ? START_LEAD : 0),
  })
  media.addEventListener('error', onFatal)
  const stop = followSound(media, sound, { onSynced, onBlocked })
  return () => {
    stop()
    media.removeEventListener('error', onFatal)
    handle.destroy()
    media.pause()
    media.removeAttribute('src')
    media.load()
    onSynced(false)
    onBlocked(null)
  }
}
