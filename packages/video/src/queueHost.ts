import type { AudioEngine } from './audioEngine'
import type { AudioHost, ControllerState } from './queueController'

/**
 * `VideoPlayer` 가 대기열과 맺는 길 - 컨트롤러의 상태를 읽는 손잡이만 받는다. 재생기는 소리를 건드리지 않는다
 * (소리 판이 있는 곡의 소리는 늘 대기열 `<audio>` 가 낸다)
 */
export function createAudioHost(ctx: {
  audio: AudioEngine
  state: () => ControllerState
  setPreferred: AudioHost['setPreferred']
  registerOutput: AudioHost['registerOutput']
  fullscreen: AudioHost['fullscreen']
  quality: AudioHost['quality']
}): AudioHost {
  const { audio, state } = ctx
  return {
    registerOutput: ctx.registerOutput,
    setPreferred: ctx.setPreferred,
    fullscreen: ctx.fullscreen,
    quality: ctx.quality,
    element: () => audio.element() as HTMLAudioElement | null,
    status: () => {
      const { queue, playing } = state()
      return queue.currentId !== null && audio.loadedItem() === queue.currentId
        ? { playing, at: audio.position() }
        : null
    },
  }
}
