/** IFrame Player API 에서 이 패키지가 쓰는 만큼 - 가짜로 바꿔 끼우기 쉽게 좁혔다 */
export type YouTubePlayer = {
  destroy: () => void
  playVideo: () => void
  pauseVideo: () => void
}

export type YouTubeStates = { ENDED: number; PLAYING: number; PAUSED: number }

export type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      playerVars?: Record<string, number | string>
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void
        onStateChange?: (event: { data: number }) => void
        onError?: (event: { data: number }) => void
      }
    },
  ) => YouTubePlayer
  PlayerState: YouTubeStates
}

/** `onError` 코드 - 2(잘못된 id) · 5(HTML5 재생기 오류) · 100(없거나 비공개) · 101 · 150(퍼가기 금지). 목록에 없는 코드도 똑같이 실패로 본다 */
export const YT_ERROR_CODES = [2, 5, 100, 101, 150] as const

const SCRIPT = 'https://www.youtube.com/iframe_api'

type World = {
  win: { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void }
  doc: {
    createElement: (tag: 'script') => { src: string; onerror: (() => void) | null }
    head: { appendChild: (node: unknown) => void }
  }
}

/**
 * IFrame API 스크립트 불러오기 - **유튜브 항목이 처음 나올 때만** 불린다(부르기 전에는 아무것도 받지 않는다). 한 번 불러오면 같은 약속을 돌려주고,
 * 실패하면(스크립트 오류 · 시간 초과) 약속을 비워 다음 유튜브 항목이 다시 시도할 수 있게 한다
 */
export function createYouTubeLoader(
  world: () => World,
  timeoutMs = 10_000,
): () => Promise<YouTubeApi> {
  let pending: Promise<YouTubeApi> | null = null
  return () => {
    if (pending) return pending
    const { win, doc } = world()
    if (win.YT?.Player) return Promise.resolve(win.YT)
    const attempt = new Promise<YouTubeApi>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('YouTube IFrame API timed out')), timeoutMs)
      const previous = win.onYouTubeIframeAPIReady
      win.onYouTubeIframeAPIReady = () => {
        clearTimeout(timer)
        previous?.()
        resolve(win.YT!)
      }
      const script = doc.createElement('script')
      script.src = SCRIPT
      script.onerror = () => {
        clearTimeout(timer)
        reject(new Error('YouTube IFrame API script failed to load'))
      }
      doc.head.appendChild(script)
    })
    pending = attempt
    attempt.catch(() => {
      if (pending === attempt) pending = null
    })
    return attempt
  }
}

export const loadYouTubeApi = createYouTubeLoader(
  () => ({ win: window, doc: document }) as unknown as World,
)

/** 플레이어 이벤트를 대기열의 말로 - 끝 · 틀기/멈춤 · (어떤 코드든) 실패 */
export function youtubeHandlers(
  states: YouTubeStates,
  on: { onEnded: () => void; onFailed: () => void; onPlaying: (playing: boolean) => void },
) {
  return {
    onStateChange: ({ data }: { data: number }) => {
      if (data === states.ENDED) on.onEnded()
      else if (data === states.PLAYING) on.onPlaying(true)
      else if (data === states.PAUSED) on.onPlaying(false)
    },
    onError: (event?: { data: number }) => {
      void event // 코드는 가리지 않는다
      on.onFailed()
    },
  }
}
