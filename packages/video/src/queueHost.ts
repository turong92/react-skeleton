import type { AudioEngine } from './audioEngine'
import type { AudioHost, ControllerState } from './queueController'

/**
 * `VideoPlayer` 가 대기열의 `<audio>` 를 빌려 쓰는 길 - 컨트롤러의 상태를 읽고 바꾸는 손잡이만 받는다.
 * 화면이 꺼져 자동으로 넘어온 것(`visible` 이 false)은 사용자의 선택이 아니므로 선호는 그대로 둔다
 */
export function createAudioHost(ctx: {
  audio: AudioEngine
  state: () => ControllerState
  visible: () => boolean
  emit: (patch: Partial<ControllerState>) => void
  /** 요소를 깨웠다 / 틀기 시작했다 - 다시 깨우지 않아도 된다 */
  markAwake: () => void
  /** 멈춤 표시를 푼다 */
  clearHalt: () => void
}): AudioHost {
  const { audio, state, emit } = ctx
  return {
    element: () => audio.element() as HTMLAudioElement | null,
    wake: (url) => {
      audio.wake(url)
      ctx.markAwake()
    },
    start: (request) => {
      audio.start({ ...request, itemId: state().queue.currentId ?? undefined })
      ctx.markAwake()
      ctx.clearHalt()
      emit({
        mode: 'audio',
        playing: request.play,
        ...(ctx.visible() ? { preferred: 'audio' } : {}),
      })
    },
    stop: () => {
      audio.stop()
      emit({ mode: 'video', preferred: 'video', playing: false })
    },
    status: () => {
      const { mode, queue, playing } = state()
      return mode === 'audio' && queue.currentId !== null && audio.loadedItem() === queue.currentId
        ? { playing, at: audio.position() }
        : null
    },
  }
}
