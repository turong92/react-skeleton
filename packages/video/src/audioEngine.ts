import { attachSource, type LoadHls } from './attachSource'
import { wakeAudio } from './autoAudio'

/** `<audio>` 가 이 모듈에서 쓰이는 만큼 - 시험에서는 가짜로 바꿔 끼운다 */
export type AudioLike = Pick<
  HTMLAudioElement,
  | 'src'
  | 'currentTime'
  | 'duration'
  | 'volume'
  | 'muted'
  | 'paused'
  | 'addEventListener'
  | 'removeEventListener'
  | 'play'
  | 'pause'
  | 'getAttribute'
  | 'ended'
>

export type AudioStart = {
  /** 소리 판 재생 목록 */
  url: string
  /** 이 시각(초)에서 */
  at: number
  /** 붙인 뒤 바로 트나 */
  play: boolean
  /** 재생기가 화면이 꺼지는 순간 이미 틀기 시작했다 - 다시 붙이지 않고 맡기만 한다 */
  adopt: boolean
  /** 이 소리 판이 어느 곡의 것인가 - 지워진 곡 · 이전 목록의 곡을 이어 트지 않게 엔진이 기억한다 */
  itemId?: string
}

/**
 * 대기열이 쥔 `<audio>` 하나를 계속 다시 쓰는 엔진. 아이폰은 손짓 없는 새 요소의 `play()` 를 막으므로 요소를 새로 만들지 않고
 * 같은 요소에 다음 곡을 붙인다(첫 손짓에서 한 번 깨워 둔 요소). hls.js 도 이 요소에 붙인다
 */
export type AudioEngine = {
  setElement: (element: AudioLike | null) => void
  element: () => AudioLike | null
  /** 첫 손짓 안에서 깨워 둔다(네이티브 HLS 일 때만 쓰인다) */
  wake: (url: string) => void
  start: (request: AudioStart) => void
  /** 멈추고 hls.js 를 걷는다 - 붙은 주소(`src`)는 남긴다 */
  stop: () => void
  pause: () => void
  resume: () => void
  restart: () => void
  position: () => number
  /** 길이(초) - 모르면(NaN · 라이브) 0 */
  duration: () => number
  seek: (seconds: number) => void
  /** `volume` 0~1 - 아이폰은 `volume` 쓰기를 무시하지만 `muted` 는 먹는다 */
  setVolume: (volume: number, muted: boolean) => void
  /** 지금 붙어 있는 소리 판의 곡 - 아무것도 없으면(새로 고침 뒤 · 멈춘 뒤) null */
  loadedItem: () => string | null
}

export function createAudioEngine(deps: {
  /** 이 기기가 HLS 를 어떻게 트나 - 못 틀면 null */
  engine: () => 'native' | 'hlsjs' | null
  loadHls: LoadHls
  /** 이 곡은 틀 수 없다(hls.js 치명 오류 · 불러오기 실패) */
  onFatal: () => void
  /** 폰이 `play()` 를 거절했다(손짓이 없었다) - 틀고 있다고 말하지 않도록 */
  onPlayRejected?: () => void
}): AudioEngine {
  let el: AudioLike | null = null
  let handle: { destroy: () => void } | null = null
  let loaded: string | null = null
  /** 틀기를 바란다 - 멈추기 · 정지가 지운다. hls.js 가 붙으며 지워진 `play()` 를 다시 걸 때 본다 */
  let wantPlay = false
  let stopWaiting: (() => void) | null = null
  const play = () =>
    void el?.play()?.catch((error: unknown) => {
      // 새 곡을 붙이느라 끊긴 것(AbortError)은 거절이 아니다
      if ((error as { name?: string } | null)?.name !== 'AbortError') deps.onPlayRejected?.()
    })
  return {
    setElement: (element) => {
      if (!element) {
        // 요소가 사라진다 - hls.js 를 걷는다
        handle?.destroy()
        handle = null
        loaded = null
      }
      el = element
    },
    element: () => el,
    wake: (url) => {
      // 네이티브 HLS 가 아닌 기기(크롬 · 안드로이드 · 데스크톱)는 재생 목록 주소를 요소에 바로 못 튼다 - 실패한 로드가 첫 play() 를 막는다.
      // 거기서는 손짓이 한 번 있었다는 것(사용자 활성)으로 충분해 깨우지 않는다
      if (el && deps.engine() === 'native') wakeAudio(el, url)
    },
    start: ({ url, at, play: playNow, adopt, itemId }) => {
      const kind = deps.engine()
      if (!el || !kind) return deps.onFatal()
      // 같은 곡을 큰 화면이 이어받는 것이면 틀고 있는 걸 건드리지 않는다(hls.js 를 걷으면 끊긴다)
      if (adopt && itemId !== undefined && loaded === itemId) return
      handle?.destroy()
      handle = null
      if (!adopt) {
        handle = attachSource(el, url, kind, {
          loadHls: deps.loadHls,
          onFatal: deps.onFatal,
          startAt: at,
        })
      }
      loaded = itemId ?? null
      wantPlay = playNow && !adopt
      stopWaiting?.()
      stopWaiting = null
      if (wantPlay) {
        play()
        if (kind === 'hlsjs') {
          // hls.js 가 스트림을 붙이면 요소가 다시 불려 먼저 건 play() 가 지워진다 - 메타데이터가 오면 아직 바라고 있을 때 다시 건다
          const element = el
          const again = () => {
            if (wantPlay && element.paused) play()
          }
          element.addEventListener('loadedmetadata', again, { once: true })
          stopWaiting = () => element.removeEventListener('loadedmetadata', again)
        }
      }
    },
    stop: () => {
      wantPlay = false
      stopWaiting?.()
      stopWaiting = null
      handle?.destroy()
      handle = null
      loaded = null
      el?.pause()
    },
    pause: () => {
      wantPlay = false
      el?.pause()
    },
    resume: () => {
      wantPlay = true
      play()
    },
    restart: () => {
      if (!el) return
      el.currentTime = 0
      wantPlay = true
      play()
    },
    position: () => el?.currentTime ?? 0,
    duration: () => (el && Number.isFinite(el.duration) ? el.duration : 0),
    seek: (seconds) => {
      if (el) el.currentTime = seconds
    },
    setVolume: (volume, muted) => {
      if (!el) return
      el.volume = volume
      el.muted = muted
    },
    loadedItem: () => loaded,
  }
}
