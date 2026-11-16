import type { AudioEngine, AudioLike, AudioStart } from './audioEngine'
import { listenAudio } from './audioEvents'
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
import type { MediaOutput } from './mediaOutput'
import {
  DEFAULT_QUEUE_KEY,
  loadQueue,
  loadVolume,
  saveQueue,
  saveVolume,
  type QueueStorage,
} from './queueStorage'
import { createAudioHost } from './queueHost'
import { canPlayNow, firstAudioUrl, hasAudio, routeOf, type Preference } from './queueRouting'

/** `audio` = 대기열이 쥔 `<audio>` 로 소리만(화면이 꺼져도 이어진다), `video` = 화면의 재생기(영상 · 유튜브)가 튼다 */
export type QueueMode = 'audio' | 'video'

export type ControllerState = {
  queue: QueueState
  /** 지금 곡이 놓인 곳 */
  mode: QueueMode
  /** 사용자가 고른 「영상 / 노래」 - 곡이 바뀌어도 유지된다 */
  preferred: Preference
  playing: boolean
  /**
   * 화면의 재생기(유튜브 · 영상)를 (다시) 처음부터 틀라는 신호 - 대기열이 그 곡을 틀기 시작할 때마다 오른다
   * (다음 곡으로 넘어갔을 때 · 한 곡 반복 · 다시 틀기)
   */
  stageStart: number
  /** 대기열이 이 곡을 소리로 (다시) 틀기 시작할 때마다 오른다 - 이미 그려진 큰 화면의 재생기가 이어받는다 */
  audioStart: number
  /** 음량 0~1 - 대기열 `<audio>` · 화면 영상 · 유튜브에 같이 걸린다 */
  volume: number
  muted: boolean
}

/** 진행 막대가 읽는 값 - 길이를 모르면 0 */
export type QueueProgress = { currentTime: number; duration: number }
const NO_PROGRESS: QueueProgress = { currentTime: 0, duration: 0 }

/** `VideoPlayer` 가 대기열의 `<audio>` 를 빌려 쓰는 길 - 요소를 새로 만들지 않아 아이폰에서도 화면이 꺼진 채 다음 곡으로 넘어간다 */
export type AudioHost = {
  element: () => HTMLAudioElement | null
  wake: (url: string) => void
  start: (request: Omit<AudioStart, 'itemId'>) => void
  /** 영상으로 돌아간다 - 소리를 멈추고 대기열을 「영상」 모드로 */
  stop: () => void
  /** 대기열이 지금 곡을 소리로 틀고 있나 - 큰 화면의 재생기가 처음부터 틀지 않고 이어받는다. 아니면 null */
  status: () => { playing: boolean; at: number } | null
  /** 화면 `<video>` 를 소리 내는 쪽으로 등록한다(진행 막대 · 음량) - 돌려받은 함수가 푼다 */
  registerOutput: (output: MediaOutput) => () => void
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
    preferred: 'audio',
    playing: false,
    stageStart: 0,
    audioStart: 0,
    volume: 1,
    muted: false,
  }
  let stages = 0
  let visible = true
  let failures = 0
  /** 멈췄다(끝 · 전부 건너뜀 · 연달아 실패) - 그 뒤 늦게 오는 「playing」 이벤트가 다시 켜지 못하게 */
  let halted = false
  /** 요소를 한 번 깨웠다 */
  let awake = false
  const listeners = new Set<() => void>()
  let detach: (() => void) | null = null

  const emit = (patch: Partial<ControllerState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
    refreshProgress()
  }

  /** 화면의 재생기(영상 · 유튜브)가 등록한 것 - 영상 모드에서 소리를 내는 쪽 */
  let output: MediaOutput | null = null
  const applyVolume = () => {
    audio.setVolume(state.volume, state.muted)
    output?.applyVolume(state.volume, state.muted)
  }

  /** 화면의 `<video>` · 유튜브 플레이어를 소리 내는 쪽으로 등록한다 - 등록하자마자 지금 음량이 걸린다. 푸는 함수는 그 사이 새로 등록된 것을 지우지 않는다 */
  const registerOutput = (next: MediaOutput) => {
    output = next
    next.applyVolume(state.volume, state.muted)
    refreshProgress()
    return () => {
      if (output !== next) return
      output = null
      refreshProgress()
    }
  }

  // 진행 막대: 소리 모드는 대기열 <audio>, 영상 모드는 등록된 출력. 이벤트가 아니라 짧은 간격으로 읽는다(유튜브는 이벤트가 없다) -
  // 상태(usePlayQueue)에 넣지 않는 것은 초당 몇 번 바뀌는 값이 대기열을 쓰는 모든 화면을 다시 그리게 하지 않으려는 것
  let progressNow: QueueProgress = NO_PROGRESS
  const progressListeners = new Set<() => void>()
  let progressTimer: ReturnType<typeof setInterval> | undefined
  const readProgress = (): QueueProgress => {
    const item = currentOf(state.queue)
    if (!item) return NO_PROGRESS
    if (state.mode === 'audio') {
      return audio.loadedItem() === item.id
        ? { currentTime: audio.position(), duration: audio.duration() }
        : NO_PROGRESS
    }
    return output ? output.read() : NO_PROGRESS
  }
  const refreshProgress = () => {
    const next = readProgress()
    if (next.currentTime === progressNow.currentTime && next.duration === progressNow.duration)
      return
    progressNow = next
    for (const listener of progressListeners) listener()
  }
  const dispatch = (action: QueueAction) => {
    const queue = reduceQueue(state.queue, action)
    if (queue === state.queue) return
    saveQueue(storage, key, queue)
    emit({ queue })
  }

  const routing = () => ({ preferred: state.preferred, stageOpen: stages > 0 && visible })
  const canPlay = (item: QueueItem) => canPlayNow(item, routing())

  /** 손짓 안에서 요소를 깨운다 - 유튜브 · 소리 판 없는 영상으로 시작해도 나중 소리 곡의 `play()` 가 거절되지 않게 */
  const wakeForGesture = () => {
    if (awake || audio.loadedItem() !== null) return
    const url = firstAudioUrl(state.queue)
    if (!url) return
    audio.wake(url)
    awake = true
  }

  /** 현재 곡을 튼다 - 어디서 틀지는 선호 · 화면 상태로 정한다(소리 `<audio>` 또는 화면의 재생기) */
  const begin = (at = 0) => {
    const item = currentOf(state.queue)
    if (!item) return
    halted = false
    if (routeOf(item, routing()) === 'audio' && item.kind === 'media' && item.source.audio) {
      audio.start({ url: item.source.audio, at, play: true, adopt: false, itemId: item.id })
      // 시작하자마자 못 틀어 멈췄거나 다른 곡으로 넘어갔으면(동기로 알림이 온다) 덮어쓰지 않는다
      if (halted || state.queue.currentId !== item.id) return
      awake = true
      emit({ mode: 'audio', playing: true, audioStart: state.audioStart + 1 })
    } else {
      audio.stop()
      emit({ mode: 'video', playing: true, stageStart: state.stageStart + 1 })
    }
  }

  /** 사용자가 고른 곡(손짓) - 영상으로만 되는 곡이면 선호도 영상으로 */
  const startChosen = () => {
    const item = currentOf(state.queue)
    if (item && !hasAudio(item) && state.preferred !== 'video') emit({ preferred: 'video' })
    failures = 0
    begin()
  }

  const halt = () => {
    halted = true
    audio.stop()
    emit({ playing: false })
  }

  /** 다음 곡으로 - 건너뛸 곡뿐이거나 끝이면 멈춘다(처음으로 돌아 무한히 건너뛰지 않는다) */
  const advance = (auto: boolean) => {
    const id = nextPlayableId(state.queue, canPlay, auto)
    if (id === null) return halt()
    dispatch({ type: 'current', id })
    begin()
  }

  /** 틀지 못했다(소리 판 · 영상 · 유튜브 오류) - 묻지 않고 다음 곡. 연달아 곡 수만큼 틀리면 멈춘다 */
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
    if (item && state.mode === 'audio' && audio.loadedItem() === item.id) audio.restart()
    else begin()
  }

  const controller = {
    /** 대기열의 `<audio>` 를 꽂는다(`ref` 로 쓴다) - 곡이 끝나거나 틀리거나 틀기 시작하는 것을 대기열이 듣는다 */
    attachElement: (element: AudioLike | null) => {
      detach?.()
      detach = null
      awake = false
      audio.setElement(element)
      if (!element) return
      applyVolume()
      detach = listenAudio(element, {
        ended: () => controller.audioEnded(),
        error: () => controller.audioFailed(),
        playing: () => controller.audioPlaying(),
        paused: () => controller.audioPaused(),
      })
    },
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    /** 저장된 대기열을 불러온다 - 새로 고침 뒤 · 아직 아무것도 안 담았을 때만(자동으로 틀지는 않는다) */
    restore: () => {
      const stored = loadVolume(storage, key)
      if (stored.volume !== state.volume || stored.muted !== state.muted) {
        emit(stored)
        applyVolume()
      }
      if (state.queue.order.length > 0) return
      const queue = loadQueue(storage, key)
      if (queue !== emptyQueue) emit({ queue })
    },

    setQueue: (items: QueueItem[], options: { startId?: string; play?: boolean } = {}) => {
      dispatch({ type: 'set', items, startId: options.startId, random })
      if (!options.play) return
      wakeForGesture()
      startChosen()
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
    /** 앱이 처음 선호를 정할 때(영상 앱은 `video`) - 사용자가 전환하면 그 뒤로는 사용자의 선택이 이긴다 */
    setPreferred: (preferred: Preference) => emit({ preferred }),

    setVolume: (volume: number) => {
      if (Number.isNaN(volume)) return
      emit({ volume: Math.min(1, Math.max(0, volume)) })
      applyVolume()
      saveVolume(storage, key, state)
    },
    setMuted: (muted: boolean) => {
      emit({ muted })
      applyVolume()
      saveVolume(storage, key, state)
    },

    /** 지금 시각 · 길이 - 같은 값이면 같은 객체를 돌려준다(`useSyncExternalStore` 용) */
    progress: () => {
      refreshProgress()
      return progressNow
    },
    subscribeProgress: (listener: () => void) => {
      progressListeners.add(listener)
      progressTimer ??= setInterval(refreshProgress, 250)
      return () => {
        progressListeners.delete(listener)
        if (progressListeners.size === 0) {
          clearInterval(progressTimer)
          progressTimer = undefined
        }
      }
    },
    registerOutput,
    seek: (seconds: number) => {
      if (!Number.isFinite(seconds)) return
      const t = Math.max(0, seconds)
      if (state.mode === 'audio') audio.seek(t)
      else output?.seek(t)
      refreshProgress()
    },

    /** 사용자 손짓 안에서 불러야 한다(첫 `play()` 는 손짓이 필요하다) */
    play: (id?: string) => {
      wakeForGesture()
      if (id !== undefined) dispatch({ type: 'current', id })
      startChosen()
    },
    pause: () => {
      audio.pause()
      emit({ playing: false })
    },
    resume: () => {
      wakeForGesture()
      const item = currentOf(state.queue)
      if (!item) return
      halted = false
      if (state.mode === 'audio' && audio.loadedItem() === item.id) {
        audio.resume()
        emit({ playing: true, audioStart: state.audioStart + 1 })
      } else if (state.mode === 'video' && routeOf(item, routing()) === 'video') {
        emit({ playing: true }) // 화면의 재생기가 이어 튼다
      } else begin()
    },
    toggle: () => (state.playing ? controller.pause() : controller.resume()),
    next: () => {
      wakeForGesture()
      advance(false)
    },
    previous: () => {
      wakeForGesture()
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
      if (halted) return
      failures = 0
      emit({ playing: true })
    },
    audioPaused: () => {
      if (state.mode === 'audio') emit({ playing: false })
    },
    /** 폰이 `play()` 를 거절했다 - 틀고 있다고 하지 않는다 */
    audioRejected: () => emit({ playing: false }),

    youtubeEnded: () => advance(true),
    youtubeFailed: failed,
    youtubePlaying: (playing: boolean) => {
      if (playing) failures = 0
      emit({ playing })
    },

    /** 화면의 영상 재생기가 끝까지 틀었다 - 다음 곡은 선호(영상이면 영상, 아니면 소리 판이 있는 곡)를 따른다 */
    videoEnded: () => advance(true),
    videoFailed: failed,
    setVideoPlaying: (playing: boolean) => {
      if (state.mode === 'video') emit({ playing })
    },

    host: createAudioHost({
      audio,
      state: () => state,
      visible: () => visible,
      emit,
      registerOutput,
      markAwake: () => {
        awake = true
      },
      clearHalt: () => {
        halted = false
      },
    }),
  }
  return controller
}
