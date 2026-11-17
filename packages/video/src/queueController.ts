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
import type { QualityChoice } from './playbackPlan'
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
  /** `setPreferred` 를 부를 때마다 오른다(값이 같아도) - 그려진 재생기가 「선호 ≠ 지금 모드」면 그 모드로 옮긴다 */
  preferSignal: number
  /** 음량 0~1 - 대기열 `<audio>` · 화면 영상 · 유튜브에 같이 걸린다 */
  volume: number
  muted: boolean
  /** 지금 곡에서 고를 수 있는 화질(둘 이상일 때만 · 유튜브 · 노래 모드는 빈 배열) · 지금 고른 것 · 지금 실제로 나오는 높이 */
  qualityOptions: QualityOption[]
  quality: QualityChoice
  playingHeight: number | null
  /** 지금 전체 화면인가 - 그려진 무대가 알려 준다 */
  fullscreen: boolean
  /** 큰 화면을 전체 화면으로 할 수 있나 - 무대가 대상을 등록했고 영상 모드일 때(노래 모드 · 아이폰의 유튜브는 아니다) */
  canFullscreen: boolean
}

/** 화질 항목 - `height` 는 실제 높이(px), 모르면 null(자동은 늘 null) */
export type QualityOption = {
  value: QualityChoice
  height: number | null
  /** 호환 단(720p)을 아직 만드는 중이다 - 고를 수 없다(`setQuality` 도 무시). 앱이 「준비 중」으로 그린다 */
  pending?: boolean
}

/** 화질을 등록한 재생기가 쥐는 핸들 - 높이는 이 핸들로만 보고하고(지금 등록된 것의 보고만 받는다), `release` 로 푼다 */
export type QualityHandle = { reportHeight: (height: number | null) => void; release: () => void }

/** 그려진 `VideoPlayer` 가 등록하는 화질 선택 - 고를 수 있는 것 · 지금 고른 것 · 고르는 함수 */
export type QualityTarget = {
  options: QualityOption[]
  value: QualityChoice
  set: (quality: QualityChoice) => void
}

/** 그려진 무대(우리 영상 · 유튜브)가 등록하는 전체 화면 대상 - 무대 위 칩도 같은 `toggle` 을 쓴다 */
export type FullscreenTarget = { toggle: () => void }

/** 진행 막대가 읽는 값 - 길이를 모르면 0 */
export type ProgressSnapshot = { currentTime: number; duration: number }
const NO_PROGRESS: ProgressSnapshot = { currentTime: 0, duration: 0 }

/** `VideoPlayer` 가 대기열의 `<audio>` 를 빌려 쓰는 길 - 요소를 새로 만들지 않아 아이폰에서도 화면이 꺼진 채 다음 곡으로 넘어간다 */
export type AudioHost = {
  element: () => HTMLAudioElement | null
  wake: (url: string) => void
  start: (request: Omit<AudioStart, 'itemId'>) => void
  /** 영상으로 돌아간다 - 소리를 멈추고 대기열을 「영상」 모드로 */
  stop: () => void
  /** 대기열이 지금 곡을 소리로 틀고 있나 - 큰 화면의 재생기가 처음부터 틀지 않고 이어받는다. 아니면 null */
  status: () => { playing: boolean; at: number } | null
  /** 대기열의 지금 음량 · 음소거 - 잠깐 음소거로 붙잡았던 요소에 되돌려 걸 때 */
  levels: () => { volume: number; muted: boolean }
  /** 그려진 재생기의 화질 - `register` 로 선택지를 꽂고 돌려받은 핸들로 지금 나오는 높이를 알리고 푼다(자기 것일 때만 먹는다) */
  quality: { register: (target: QualityTarget) => QualityHandle }
  /** 그려진 무대의 전체 화면 - `register` 로 대상을 꽂고(푸는 함수는 자기 것일 때만 지운다), `report` 로 지금 전체 화면인지 알린다 */
  fullscreen: {
    register: (target: FullscreenTarget) => () => void
    report: (active: boolean) => void
  }
  /** 화면 `<video>` 를 소리 내는 쪽으로 등록한다(진행 막대 · 음량) - 돌려받은 함수가 푼다 */
  registerOutput: (output: MediaOutput) => () => void
  /**
   * 「영상」을 누르는 손짓 안에서 그려진 재생기의 `<video>` 를 깨운다(`setPreferred('video')` 가 바로 부른다) - 아이폰은 손짓 밖에서 소리 있는
   * 재생을 막는데, 전환은 effect 를 거쳐 손짓 밖에서 일어나서다. 돌려받은 함수가 푼다(자기 것일 때만)
   */
  registerVideoWaker: (wake: () => void) => () => void
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
    preferSignal: 0,
    volume: 1,
    muted: false,
    fullscreen: false,
    canFullscreen: false,
    qualityOptions: [],
    quality: 'auto',
    playingHeight: null,
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
    const next = { ...state, ...patch }
    state = { ...next, canFullscreen: fullscreenTarget !== null && next.mode === 'video' }
    for (const listener of listeners) listener()
    refreshProgress()
  }

  let fullscreenTarget: FullscreenTarget | null = null
  let qualityTarget: QualityTarget | null = null
  const registerQuality = (target: QualityTarget): QualityHandle => {
    qualityTarget = target
    emit({ qualityOptions: target.options, quality: target.value, playingHeight: null })
    return {
      reportHeight: (height) => {
        if (qualityTarget === target && height !== state.playingHeight)
          emit({ playingHeight: height })
      },
      release: () => {
        if (qualityTarget !== target) return
        qualityTarget = null
        emit({ qualityOptions: [], quality: 'auto', playingHeight: null })
      },
    }
  }
  /** 화면의 재생기(영상 · 유튜브)가 등록한 것 - 영상 모드에서 소리를 내는 쪽 */
  let output: MediaOutput | null = null
  const applyVolume = () => {
    audio.setVolume(state.volume, state.muted)
    output?.applyVolume(state.volume, state.muted)
  }

  /** 그려진 무대의 전체 화면 대상을 등록한다. 푸는 함수는 그 사이 새로 등록된 것을 지우지 않는다 */
  let videoWaker: (() => void) | null = null
  const registerVideoWaker = (wake: () => void) => {
    videoWaker = wake
    return () => {
      if (videoWaker === wake) videoWaker = null
    }
  }
  const registerFullscreen = (target: FullscreenTarget) => {
    fullscreenTarget = target
    emit({})
    return () => {
      if (fullscreenTarget !== target) return
      fullscreenTarget = null
      emit({ fullscreen: false })
    }
  }
  /** 화면의 `<video>` · 유튜브 플레이어를 소리 내는 쪽으로 등록한다 - 등록하자마자 지금 음량이 걸린다. 푸는 함수는 그 사이 새로 등록된 것을 지우지 않는다 */
  const registerOutput = (next: MediaOutput) => {
    output = next
    next.applyVolume(state.volume, state.muted)
    refreshProgress()
    return () => {
      if (output !== next) return
      output = null
      progressFrom = { id: state.queue.currentId, mode: state.mode } // 넘기다 무대가 닫혔으면 더 기다리지 않는다
      refreshProgress()
    }
  }

  // 진행 막대: 소리 모드는 대기열 <audio>, 영상 모드는 등록된 출력. 이벤트가 아니라 짧은 간격으로 읽는다(유튜브는 이벤트가 없다) -
  // 상태(usePlayQueue)에 넣지 않는 것은 초당 몇 번 바뀌는 값이 대기열을 쓰는 모든 화면을 다시 그리게 하지 않으려는 것
  let progressNow: ProgressSnapshot = NO_PROGRESS
  const progressListeners = new Set<() => void>()
  let progressTimer: ReturnType<typeof setInterval> | undefined
  const readProgress = (): ProgressSnapshot => {
    const item = currentOf(state.queue)
    if (!item) return NO_PROGRESS
    if (state.mode === 'audio') {
      return audio.loadedItem() === item.id
        ? { currentTime: audio.position(), duration: audio.duration() }
        : NO_PROGRESS
    }
    return output ? output.read() : NO_PROGRESS
  }
  let progressFrom: { id: string | null; mode: QueueMode } = { id: null, mode: 'audio' }
  const refreshProgress = () => {
    const next = readProgress()
    const from = { id: state.queue.currentId, mode: state.mode }
    // 같은 곡을 영상 <-> 소리로 넘기는 사이(새 요소가 아직 못 불러옴)에는 0 초로 튀지 않게 읽어 둔 값을 둔다
    // 멈췄으면(실패 포함) 기다릴 것이 없다 - 보류하지 않는다. 영상 출력이 풀리면 등록 해제가 보류를 푼다
    const loading = state.playing
    const switching =
      loading && from.id !== null && from.id === progressFrom.id && from.mode !== progressFrom.mode
    if (switching && next.duration === 0 && progressNow.duration > 0) return
    progressFrom = from
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
    setPreferred: (preferred: Preference) => {
      if (preferred === 'video') videoWaker?.()
      emit({ preferred, preferSignal: state.preferSignal + 1 })
    },

    setVolume: (volume: number) => {
      if (Number.isNaN(volume)) return
      emit({ volume: Math.min(1, Math.max(0, volume)) })
      applyVolume()
      saveVolume(storage, key, { volume: state.volume, muted: state.muted })
    },
    setMuted: (muted: boolean) => {
      emit({ muted })
      applyVolume()
      saveVolume(storage, key, { volume: state.volume, muted: state.muted })
    },

    /** 지금 곡을 노래(소리만)로 틀 수 있나 - 소리 판이 있고 이 기기가 틀 수 있을 때(유튜브 · 소리 판 없는 영상은 false) */
    canAudio: () => {
      const item = currentOf(state.queue)
      return item?.kind === 'media' && Boolean(item.source.audio) && audio.canPlay()
    },

    /** 지금 시각 · 길이 - 같은 값이면 같은 객체를 돌려준다(`useSyncExternalStore` 용) */
    progress: () => progressNow,
    subscribeProgress: (listener: () => void) => {
      refreshProgress() // 구독을 시작하는 순간의 값으로 맞춘다(그리는 중에는 읽지 않는다)
      progressListeners.add(listener)
      progressTimer ??= setInterval(() => {
        if (visible) refreshProgress() // 화면이 꺼지면 읽지 않는다
      }, 250)
      return () => {
        progressListeners.delete(listener)
        if (progressListeners.size === 0) {
          clearInterval(progressTimer)
          progressTimer = undefined
        }
      }
    },
    registerOutput,
    registerQuality,
    setQuality: (quality: QualityChoice) => qualityTarget?.set(quality),
    registerFullscreen,
    setFullscreen: (active: boolean) => emit({ fullscreen: active }),
    toggleFullscreen: () => fullscreenTarget?.toggle(),
    seek: (seconds: number) => {
      if (!Number.isFinite(seconds)) return
      const t = Math.max(0, seconds)
      if (state.mode === 'audio') {
        // 읽을 때와 같은 확인 - 요소가 다른 곡(없음 포함)을 쥐고 있으면 옮기지 않는다
        const id = state.queue.currentId
        if (id !== null && audio.loadedItem() === id) audio.seek(t)
      } else output?.seek(t)
      progressFrom = { id: state.queue.currentId, mode: state.mode } // 옮긴 시각을 바로 보인다(넘기는 중 보류를 푼다)
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
      if (value) refreshProgress()
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
      quality: { register: registerQuality },
      registerVideoWaker,
      fullscreen: {
        register: registerFullscreen,
        report: (active) => emit({ fullscreen: active }),
      },
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
