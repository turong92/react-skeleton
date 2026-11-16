import type { AudioLike } from './audioEngine'

export type AudioEventHandlers = {
  ended: () => void
  error: () => void
  playing: () => void
  paused: () => void
}

/** 대기열의 `<audio>` 가 곡이 끝나거나 틀리거나 틀기 시작하거나 멈추는 것을 듣는다. 돌려받은 함수가 걷는다 */
export function listenAudio(element: AudioLike, on: AudioEventHandlers): () => void {
  // 끝날 때도 pause 가 먼저 온다 - 끝난 것은 멈춤이 아니다
  const onPause = () => {
    if (!element.ended) on.paused()
  }
  element.addEventListener('ended', on.ended)
  element.addEventListener('error', on.error)
  element.addEventListener('playing', on.playing)
  element.addEventListener('pause', onPause)
  return () => {
    element.removeEventListener('ended', on.ended)
    element.removeEventListener('error', on.error)
    element.removeEventListener('playing', on.playing)
    element.removeEventListener('pause', onPause)
  }
}
