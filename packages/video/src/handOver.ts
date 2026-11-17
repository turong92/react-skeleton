type ReadyMedia = Pick<
  HTMLMediaElement,
  'readyState' | 'buffered' | 'currentTime' | 'addEventListener' | 'removeEventListener'
>

const EVENTS = ['canplay', 'canplaythrough', 'progress', 'loadeddata'] as const
/** HAVE_FUTURE_DATA - 지금 자리에서 바로 틀 수 있다 */
const READY = 3

/**
 * 소리 → 영상 이어받기: 영상이 지금 소리 위치를 틀 수 있게 될 때까지 기다렸다가(그 사이 소리는 계속 난다) 그 자리로 맞추고 `onReady` 를 부른다.
 * `at` 은 기다리는 동안 계속 흐르는 소리 위치(모르면 null - 바로 넘긴다). `timeoutMs` 가 지나면 받아 둔 만큼으로 그냥 넘긴다.
 * 돌려받은 함수는 기다림을 취소한다(`onReady` 는 불리지 않는다)
 */
export function handOverWhenReady(
  media: ReadyMedia,
  at: () => number | null,
  onReady: () => void,
  { timeoutMs = 8000 }: { timeoutMs?: number } = {},
): () => void {
  let done = false
  const stop = () => {
    done = true
    clearTimeout(timer)
    for (const name of EVENTS) media.removeEventListener(name, check)
  }
  const go = (target: number | null) => {
    stop()
    if (target !== null && Math.abs(media.currentTime - target) > 0.3) media.currentTime = target
    onReady()
  }
  const holds = (t: number) => {
    const b = media.buffered
    for (let i = 0; i < b.length; i++) if (b.start(i) <= t && t + 0.5 <= b.end(i)) return true
    return false
  }
  function check() {
    if (done) return
    const target = at()
    if (target === null) return go(null)
    if (media.readyState >= READY && holds(target)) go(target)
  }
  for (const name of EVENTS) media.addEventListener(name, check)
  const timer = setTimeout(() => {
    if (!done) go(at())
  }, timeoutMs)
  check()
  return stop
}
