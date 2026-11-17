/** hls.js 가 이 패키지에서 쓰이는 만큼의 모양 - 가짜로 바꿔 끼우기 쉽게 좁혔다 */
export type HlsLike = {
  on(event: string, handler: (event: string, data: { fatal?: boolean }) => void): void
  loadSource(url: string): void
  attachMedia(media: HTMLMediaElement): void
  destroy(): void
}
export type HlsCtor = {
  new (config?: { startPosition?: number }): HlsLike
  isSupported(): boolean
  Events: { ERROR: string }
}
/** hls.js(light) 불러오기 - 누를 때만 불린다 */
export type LoadHls = () => Promise<HlsCtor>

export type AttachOptions = {
  loadHls: LoadHls
  /** 이 걸음으로는 더 못 튼다(hls.js 치명 오류 · 불러오기 실패 · MSE 없음) */
  onFatal: () => void
  /** 이 시각(초)부터 튼다 - 화질 · 모드를 바꿔도 시각을 잇는다. 네이티브는 메타데이터가 오면 옮기고, hls.js 는 `startPosition` 으로 그 자리부터 받는다 */
  startAt?: number
}

type MediaLike = Pick<
  HTMLMediaElement,
  'src' | 'currentTime' | 'addEventListener' | 'removeEventListener'
>

/** `<video>` · `<audio>` 에 재생 목록을 붙인다. 돌려받은 `destroy` 는 엔진을 걷는다 */
export function attachSource(
  video: MediaLike,
  url: string,
  engine: 'native' | 'hlsjs',
  { loadHls, onFatal, startAt }: AttachOptions,
): { destroy: () => void } {
  let destroyed = false
  let hls: HlsLike | null = null
  const seek = () => {
    video.currentTime = startAt!
  }
  // 네이티브는 메타데이터가 오면 옮긴다. hls.js 는 처음부터 그 시각을 받아야 한다 - 안 그러면 0 초 조각부터 받아 틀다가 옮긴다
  if (startAt && engine === 'native') video.addEventListener('loadedmetadata', seek, { once: true })
  if (engine === 'native') {
    video.src = url
  } else {
    loadHls().then(
      (Hls) => {
        if (destroyed) return
        if (!Hls.isSupported()) return onFatal()
        hls = new Hls(startAt ? { startPosition: startAt } : undefined)
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal) onFatal()
        })
        hls.loadSource(url)
        hls.attachMedia(video as HTMLMediaElement)
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
