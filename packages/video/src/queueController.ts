import type { AudioEngine, AudioLike, AudioStart } from './audioEngine'
import {
  currentOf,
  emptyQueue,
  nextPlayableId,
  previousPlayableId,
  reduceQueue,
  type QueueAction,
  type QueueItem,
  type QueueState,
  type Random,
  type RepeatMode,
} from './playQueue'
import { DEFAULT_QUEUE_KEY, loadQueue, saveQueue, type QueueStorage } from './queueStorage'

/** `audio` = 대기열이 쥔 `<audio>` 로 소리만(화면이 꺼져도 이어진다), `video` = 화면의 재생기(영상 · 유튜브)가 튼다 */
export type QueueMode = 'audio' | 'video'

export type ControllerState = {
  queue: QueueState
  mode: QueueMode
  playing: boolean
  /** 한 곡 반복으로 같은 유튜브를 다시 틀라는 신호 - 오를 때마다 처음부터 */
  youtubeRestart: number
}

/** `VideoPlayer` 가 대기열의 `<audio>` 를 빌려 쓰는 길 - 요소를 새로 만들지 않아 아이폰에서도 화면이 꺼진 채 다음 곡으로 넘어간다 */
export type AudioHost = {
  element: () => HTMLAudioElement | null
  wake: (url: string) => void
  start: (request: AudioStart) => void
  /** 영상으로 돌아간다 - 소리를 멈추고 대기열을 「영상」 모드로 */
  stop: () => void
}

export type QueueController = ReturnType<typeof createQueueController>

export function createQueueController(deps: {
  audio: AudioEngine
  storage?: QueueStorage
  storageKey?: string
  random?: Random
}) {
  const { audio, storage, random = Math.random } = deps
  const key = deps.storageKey ?? DEFAULT_QUEUE_KEY
  let state: ControllerState = {
    queue: emptyQueue,
    mode: 'audio',
    playing: false,
    youtubeRestart: 0,
  }
  let stages = 0
  let visible = true
  let failures = 0
  const listeners = new Set<() => void>()
  let detach: (() => void) | null = null

  const emit = (patch: Partial<ControllerState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }
  const dispatch = (action: QueueAction) => {
    const queue = reduceQueue(state.queue, action)
    if (queue === state.queue) return
    saveQueue(storage, key, queue)
    emit({ queue })
  }

  const stageOpen = () => stages > 0 && visible
  /** 지금 틀 수 있나 - 소리 판이 있는 영상은 늘, 소리 판 없는 영상과 유튜브는 화면의 재생기가 보일 때만 */
  const canPlay = (item: QueueItem) =>
    item.kind === 'media' && item.source.audio ? true : stageOpen()

  /** 현재 곡을 튼다 - 소리 판이 있으면 `<audio>` 로, 아니면 화면의 재생기(영상 · 유튜브)에 맡긴다 */
  const begin = (at = 0) => {
    const item = currentOf(state.queue)
    if (!item) return
    if (item.kind === 'media' && item.source.audio) {
      audio.start({ url: item.source.audio, at, play: true, adopt: false })
      emit({ mode: 'audio', playing: true })
    } else {
      audio.stop()
      emit({
        mode: 'video',
        playing: item.kind === 'youtube',
        youtubeRestart: state.youtubeRestart + 1,
      })
    }
  }

  const halt = () => {
    audio.pause()
    emit({ playing: false })
  }

  /** 다음 곡으로 - 건너뛸 곡뿐이거나 끝이면 멈춘다(처음으로 돌아 무한히 건너뛰지 않는다) */
  const advance = (auto: boolean) => {
    const id = nextPlayableId(state.queue, canPlay, auto)
    if (id === null) return halt()
    dispatch({ type: 'current', id })
    begin()
  }

  /** 틀지 못했다(소리 판 오류 · 유튜브 오류) - 묻지 않고 다음 곡. 연달아 곡 수만큼 틀리면 멈춘다 */
  const failed = () => {
    failures += 1
    if (failures >= Math.max(1, state.queue.order.length)) {
      failures = 0
      return halt()
    }
    advance(false)
  }

  const restartCurrent = () => {
    const item = currentOf(state.queue)
    if (item?.kind === 'media' && item.source.audio && audio.hasSource()) audio.restart()
    else begin()
  }

  const controller = {
    /** 대기열의 `<audio>` 를 꽂는다(`ref` 로 쓴다) - 곡이 끝나거나 틀리거나 틀기 시작하는 것을 대기열이 듣는다 */
    attachElement: (element: AudioLike | null) => {
      detach?.()
      detach = null
      audio.setElement(element)
      if (!element) return
      const onEnded = () => controller.audioEnded()
      const onError = () => controller.audioFailed()
      const onPlaying = () => controller.audioPlaying()
      // 끝날 때도 pause 가 먼저 온다 - 끝난 것은 멈춤이 아니다
      const onPause = () => {
        if (!element.ended) controller.audioPaused()
      }
      element.addEventListener('ended', onEnded)
      element.addEventListener('error', onError)
      element.addEventListener('playing', onPlaying)
      element.addEventListener('pause', onPause)
      detach = () => {
        element.removeEventListener('ended', onEnded)
        element.removeEventListener('error', onError)
        element.removeEventListener('playing', onPlaying)
        element.removeEventListener('pause', onPause)
      }
    },
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    /** 저장된 대기열을 불러온다 - 새로 고침 뒤 · 아직 아무것도 안 담았을 때만(자동으로 틀지는 않는다) */
    restore: () => {
      if (state.queue.order.length > 0) return
      const queue = loadQueue(storage, key)
      if (queue !== emptyQueue) emit({ queue })
    },

    setQueue: (items: QueueItem[], options: { startId?: string; play?: boolean } = {}) => {
      dispatch({ type: 'set', items, startId: options.startId, random })
      if (options.play) begin()
    },
    add: (item: QueueItem, where: 'end' | 'next' = 'end') => dispatch({ type: 'add', item, where }),
    remove: (id: string) => {
      const wasCurrent = state.queue.currentId === id
      dispatch({ type: 'remove', id })
      if (!wasCurrent) return
      if (state.queue.currentId === null) {
        audio.stop()
        emit({ playing: false })
      } else if (state.playing) begin()
    },
    move: (id: string, to: number) => dispatch({ type: 'move', id, to }),
    clear: () => {
      dispatch({ type: 'clear' })
      audio.stop()
      emit({ playing: false })
    },
    setRepeat: (repeat: RepeatMode) => dispatch({ type: 'repeat', repeat }),
    setShuffle: (on: boolean) => dispatch({ type: 'shuffle', on, random }),

    /** 사용자 손짓 안에서 불러야 한다(첫 `play()` 는 손짓이 필요하다) */
    play: (id?: string) => {
      if (id !== undefined) dispatch({ type: 'current', id })
      failures = 0
      begin()
    },
    pause: () => {
      audio.pause()
      emit({ playing: false })
    },
    resume: () => {
      const item = currentOf(state.queue)
      if (!item) return
      if (state.mode === 'audio' && audio.hasSource()) {
        audio.resume()
        emit({ playing: true })
      } else begin()
    },
    toggle: () => (state.playing ? controller.pause() : controller.resume()),
    next: () => advance(false),
    previous: () => {
      const prev = previousPlayableId(
        state.queue,
        canPlay,
        state.mode === 'audio' ? audio.position() : 0,
      )
      if (!prev) return
      if (prev.restart) return restartCurrent()
      dispatch({ type: 'current', id: prev.id })
      begin()
    },

    /** 화면의 재생기(영상 · 유튜브)가 보이는 동안 1 이상 */
    setStage: (open: boolean) => {
      stages = Math.max(0, stages + (open ? 1 : -1))
    },
    setVisible: (value: boolean) => {
      visible = value
    },

    audioEnded: () => {
      const item = currentOf(state.queue)
      if (state.queue.repeat === 'one' && item) return audio.restart()
      advance(true)
    },
    audioFailed: failed,
    audioPlaying: () => {
      failures = 0
      emit({ playing: true })
    },
    audioPaused: () => {
      if (state.mode === 'audio') emit({ playing: false })
    },

    youtubeEnded: () => advance(true),
    youtubeFailed: failed,
    youtubePlaying: (playing: boolean) => {
      if (playing) failures = 0
      emit({ playing })
    },

    /** 화면의 영상 재생기가 끝까지 틀었다 - 다음 곡부터는 소리 판이 있으면 소리로 이어 간다 */
    videoEnded: () => advance(true),
    setVideoPlaying: (playing: boolean) => {
      if (state.mode === 'video') emit({ playing })
    },

    host: {
      element: () => audio.element() as HTMLAudioElement | null,
      wake: (url) => audio.wake(url),
      start: (request) => {
        audio.start(request)
        emit({ mode: 'audio', playing: request.play })
      },
      stop: () => {
        audio.stop()
        emit({ mode: 'video', playing: false })
      },
    } satisfies AudioHost,
  }
  return controller
}
