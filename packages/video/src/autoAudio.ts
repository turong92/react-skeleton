import type { PlayIntent } from './playIntent'

type Wakeable = { src: string; play: () => Promise<void> | undefined; pause: () => void }

/**
 * 첫 재생 손짓 안에서 `<audio>` 를 깨워 둔다 - 소리 판을 붙이고 `play()` 직후 `pause()`. 아이폰은 손짓 밖(화면이 꺼지는 순간)의
 * 첫 `play()` 를 막는데, 이렇게 한 번 틀어 본 요소는 나중에 틀 수 있다. **기다리지 않는다** - `await` 하면 영상 시작까지 막힌다(아이폰 실측)
 */
export function wakeAudio(audio: Wakeable, url: string): void {
  audio.src = url
  audio.play()?.catch(() => {})
  audio.pause()
}

export type HiddenWatch = {
  doc: {
    visibilityState: string
    addEventListener: (type: 'visibilitychange', listener: () => void) => void
    removeEventListener: (type: 'visibilitychange', listener: () => void) => void
  }
  intent: PlayIntent
  video: () => { currentTime: number } | null
  audio: () => {
    src: string
    currentTime: number
    getAttribute: (name: string) => string | null
    play: () => Promise<void> | undefined
  } | null
  /** 지금 허가의 소리 판 주소 - 깨워 둘 때(예전 허가)와 다르면 바꿔 넣는다 */
  audioUrl: () => string | null | undefined
  /** 네이티브 HLS - 그러면 깨워 둔(소리 판이 붙어 있는) `<audio>` 를 이 이벤트 안에서 바로 튼다. 아니면(hls.js) 전환만 알리고 붙이는 건 그 뒤 */
  native: boolean
  /** 소리 판으로 넘겼다 - `adopt` 는 `<audio>` 가 이미 틀고 있어 다시 붙이지 말라는 뜻 */
  onHandoff: (info: { at: number; adopt: boolean }) => void
  /** 폰이 `<audio>` 재생을 거절했다 - 상태를 멈춤으로 바로잡을 때 */
  onHandoffFailed: () => void
}

/** 화면이 꺼지거나 앱을 나가면(`visibilitychange` hidden) 재생 중이던 영상을 같은 시각의 소리 판으로 넘긴다. 돌려받은 함수가 걷는다 */
export function watchHidden({
  doc,
  intent,
  video,
  audio,
  audioUrl,
  native,
  onHandoff,
  onHandoffFailed,
}: HiddenWatch): () => void {
  const onChange = () => {
    if (doc.visibilityState !== 'hidden' || !intent.wasPlaying()) return
    const v = video()
    if (!v) return
    const at = v.currentTime
    const a = native ? audio() : null
    if (a) {
      const url = audioUrl()
      if (url && a.getAttribute('src') !== url) a.src = url
      a.currentTime = at
      a.play()?.catch(onHandoffFailed)
    }
    onHandoff({ at, adopt: a !== null })
  }
  doc.addEventListener('visibilitychange', onChange)
  return () => doc.removeEventListener('visibilitychange', onChange)
}
