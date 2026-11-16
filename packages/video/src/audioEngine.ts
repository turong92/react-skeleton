import { attachSource, type LoadHls } from './attachSource'
import { wakeAudio } from './autoAudio'

/** `<audio>` 가 이 모듈에서 쓰이는 만큼 - 시험에서는 가짜로 바꿔 끼운다 */
export type AudioLike = Pick<
  HTMLAudioElement,
  | 'src'
  | 'currentTime'
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
  /** 틀 수 있게 붙어 있나(새로 고침 뒤에는 없다) */
  hasSource: () => boolean
}

export function createAudioEngine(deps: {
  /** 이 기기가 HLS 를 어떻게 트나 - 못 틀면 null */
  engine: () => 'native' | 'hlsjs' | null
  loadHls: LoadHls
  /** 이 곡은 틀 수 없다(hls.js 치명 오류 · 불러오기 실패) */
  onFatal: () => void
}): AudioEngine {
  let el: AudioLike | null = null
  let handle: { destroy: () => void } | null = null
  let attached = false
  const play = () => void el?.play()?.catch(() => {})
  return {
    setElement: (element) => {
      el = element
    },
    element: () => el,
    wake: (url) => {
      if (el) wakeAudio(el, url)
    },
    start: ({ url, at, play: playNow, adopt }) => {
      const kind = deps.engine()
      if (!el || !kind) return deps.onFatal()
      handle?.destroy()
      handle = null
      if (!adopt) {
        handle = attachSource(el, url, kind, {
          loadHls: deps.loadHls,
          onFatal: deps.onFatal,
          startAt: at,
        })
      }
      attached = true
      if (playNow && !adopt) play()
    },
    stop: () => {
      handle?.destroy()
      handle = null
      el?.pause()
    },
    pause: () => el?.pause(),
    resume: play,
    restart: () => {
      if (!el) return
      el.currentTime = 0
      play()
    },
    position: () => el?.currentTime ?? 0,
    hasSource: () => attached && (handle !== null || Boolean(el?.getAttribute('src'))),
  }
}
