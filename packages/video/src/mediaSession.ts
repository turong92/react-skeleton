type Details = { seekTime?: number | null }
type Handler = (details: Details) => void

export type MediaSessionLike = {
  metadata: unknown
  setActionHandler(action: string, handler: Handler | null): void
}

type MetadataCtor = new (init: { title?: string; artwork?: Array<{ src: string }> }) => unknown

type Playable = Pick<HTMLMediaElement, 'currentTime' | 'duration' | 'play' | 'pause'>

export type MediaSessionInput = {
  title?: string
  poster?: string
  /** 지금 틀고 있는 요소(영상 또는 소리) - 단추를 누른 순간에 읽는다 */
  media: () => Playable | null
  onPrevious?: () => void
  onNext?: () => void
  /** 잠금화면 · 이어폰의 멈춤 단추를 눌렀다 - 사용자가 멈춘 것이다(OS 가 화면을 끄며 멈춘 것과 구분) */
  onUserPause?: () => void
}

const SEEK_SECONDS = 10

/**
 * 잠금화면 · 제어 센터 · 알림창 · 이어폰 단추. 제목 · 포스터를 띄우고 재생 · 일시정지 · 이동을 받는다.
 * 아이폰 잠금화면은 seekbackward/seekforward 핸들러가 있으면 ±10초만, 없으면 이전/다음만 보이므로(실측) 둘 중 하나만 등록한다 -
 * 앱이 `onPrevious` 나 `onNext` 를 주면 이전/다음, 아니면 ±10초. 돌려받은 함수가 전부 걷는다
 */
export function bindMediaSession(
  session: MediaSessionLike | undefined,
  { title, poster, media, onPrevious, onNext, onUserPause }: MediaSessionInput,
  Metadata: MetadataCtor | undefined = typeof MediaMetadata === 'undefined'
    ? undefined
    : (MediaMetadata as MetadataCtor),
): () => void {
  if (!session) return () => {}
  const registered: string[] = []
  const on = (action: string, handler: Handler) => {
    try {
      session.setActionHandler(action, handler)
      registered.push(action)
    } catch {
      // 이 브라우저가 모르는 단추 이름 - 건너뛴다
    }
  }
  const seekBy = (seconds: number) => () => {
    const m = media()
    if (!m) return
    const end = Number.isFinite(m.duration) ? m.duration : Infinity
    m.currentTime = Math.min(Math.max(m.currentTime + seconds, 0), end)
  }

  if ((title || poster) && Metadata) {
    session.metadata = new Metadata({
      title,
      ...(poster ? { artwork: [{ src: poster }] } : {}),
    })
  }
  on(
    'play',
    () =>
      void media()
        ?.play()
        ?.catch(() => {}),
  )
  on('pause', () => {
    onUserPause?.()
    media()?.pause()
  })
  on('seekto', ({ seekTime }) => {
    const m = media()
    if (m && typeof seekTime === 'number') m.currentTime = seekTime
  })
  if (onPrevious || onNext) {
    if (onPrevious) on('previoustrack', () => onPrevious())
    if (onNext) on('nexttrack', () => onNext())
  } else {
    on('seekbackward', seekBy(-SEEK_SECONDS))
    on('seekforward', seekBy(SEEK_SECONDS))
  }

  return () => {
    for (const action of registered) {
      try {
        session.setActionHandler(action, null)
      } catch {
        // 이미 없다
      }
    }
    session.metadata = null
  }
}
