/** 이 시간 안에 온 `pause` 는 사용자가 멈춘 것이 아니라 OS 가 화면을 끄며 멈춘 것일 수 있다 */
const OS_PAUSE_WINDOW_MS = 1000

/**
 * 「사용자가 재생 중이었나」 - 잠글 때 OS 가 `<video>` 를 `visibilitychange` 직전에 먼저 멈추므로(`pause` 이벤트가 먼저 온다)
 * 그 순간의 `paused` 로는 알 수 없다. 재생 · 멈춤 · 끝 이벤트를 따로 모아 두고, 방금(1초 안) 멈췄다면 멈추기 전 상태를 돌려준다
 */
export function createPlayIntent(now: () => number = Date.now) {
  let playing = false
  let prior = false
  let pausedAt = -Infinity
  return {
    play() {
      prior = false
      playing = true
    },
    pause() {
      if (!playing) return
      prior = true
      pausedAt = now()
      playing = false
    },
    /** 끝까지 틀었다 - 끝나기 직전의 `pause` 는 멈춤이 아니다 */
    ended() {
      prior = false
      playing = false
    },
    wasPlaying: () => playing || (prior && now() - pausedAt <= OS_PAUSE_WINDOW_MS),
  }
}

export type PlayIntent = ReturnType<typeof createPlayIntent>
