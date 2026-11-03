/** hls.js 가 이 패키지에서 쓰이는 만큼의 모양 - 가짜로 바꿔 끼우기 쉽게 좁혔다 */
export type HlsLike = {
  on(event: string, handler: (event: string, data: { fatal?: boolean }) => void): void
  loadSource(url: string): void
  attachMedia(video: HTMLVideoElement): void
  destroy(): void
}
export type HlsCtor = {
  new (): HlsLike
  isSupported(): boolean
  Events: { ERROR: string }
}
/** hls.js(light) 불러오기 - 누를 때만 불린다 */
export type LoadHls = () => Promise<HlsCtor>

export type AttachOptions = {
  loadHls: LoadHls
  /** 이 걸음으로는 더 못 튼다(hls.js 치명 오류 · 불러오기 실패 · MSE 없음) */
  onFatal: () => void
  /** 메타데이터가 오면 이 시각(초)으로 간다 - 화질을 바꿔도 시각을 잇는다 */
  startAt?: number
}

type VideoLike = Pick<
  HTMLVideoElement,
  'src' | 'currentTime' | 'addEventListener' | 'removeEventListener'
>

/** `<video>` 에 재생 목록을 붙인다. 돌려받은 `destroy` 는 엔진을 걷는다 */
export function attachSource(
  video: VideoLike,
  url: string,
  engine: 'native' | 'hlsjs',
  { loadHls, onFatal, startAt }: AttachOptions,
): { destroy: () => void } {
  let destroyed = false
  let hls: HlsLike | null = null
  const seek = () => {
    video.currentTime = startAt!
  }
  if (startAt) video.addEventListener('loadedmetadata', seek, { once: true })
  if (engine === 'native') {
    video.src = url
  } else {
    loadHls().then(
      (Hls) => {
        if (destroyed) return
        if (!Hls.isSupported()) return onFatal()
        hls = new Hls()
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal) onFatal()
        })
        hls.loadSource(url)
        hls.attachMedia(video as HTMLVideoElement)
      },
      () => {
        if (!destroyed) onFatal()
      },
    )
  }
  return {
    destroy: () => {
      destroyed = true
      video.removeEventListener('loadedmetadata', seek)
      hls?.destroy()
      hls = null
    },
  }
}
