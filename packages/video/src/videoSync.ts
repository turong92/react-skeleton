/** 이보다 크게 어긋나면 옮긴다(초) */
const JUMP = 0.3
/** 이보다 작게 어긋난 것은 어긋남으로 치지 않는다(초) */
const NEAR = 0.02
/** 작게 어긋났을 때 어긋난 만큼 속도를 바꾼다 - 1초 어긋남당 이만큼(0.1초 뒤처지면 1.2배) */
const GAIN = 2
/** 속도를 바꾸는 상한 - 0.3초 뒤처져도 1.25배까지 */
const NUDGE_MAX = 0.25
/** 옮긴 뒤 이 시간 안에는 다시 옮기지 않는다 - 옮긴 자리를 받아 오는 중이다(ms) */
const SETTLE_MS = 1000
/** 옮길 때 소리보다 이만큼 앞을 겨눈다 - 받는 동안 소리가 흐른다(초) */
const AHEAD = 0.5
/**
 * 이만큼보다 앞서 있으면(그리고 HOLD_MAX 안이면) 옮기지 않고 멈춰 기다린다(초) - 속도만 바꿔서는 입 모양이 오래 어긋난다.
 * 상한은 우리가 옮겨 놓은 앞(AHEAD)에 여유를 더한 만큼 - 그보다 앞섰다면 사용자가 소리를 되감은 것이라 기다리지 않고 바로 옮긴다
 */
const HOLD_MIN = 0.1
const HOLD_MAX = AHEAD + 0.8
/** 소리가 영상 끝에서 이만큼 안이면 영상은 끝에 세운다(초) */
const END = 0.05

export type SyncInput = {
  /** 영상 시각 · 소리 시각(초) */
  video: number
  sound: number
  soundPlaying: boolean
  /** 영상 길이 - 모르면 NaN */
  duration: number
  /** 마지막으로 옮긴 뒤 흐른 시간(ms) */
  sinceSeekMs: number
}

/** `wakeInMs` - 앞서 기다리는 중이면 소리가 닿을 때까지 남은 시간(그때 다시 잰다) */
export type SyncPlan = { seekTo: number | null; rate: number; play: boolean; wakeInMs?: number }

/**
 * 영상(음소거)이 소리를 따라가는 법 - 소리가 기준이다. 크게 어긋나면 소리 시각으로 옮기고, 작게 어긋나면 어긋난 만큼 속도를 바꿔(최대 ±25%) 1초 안쪽에 수렴하고, 거의 맞으면 1.
 * 소리가 멈추면 영상도 멈춘다(사용자가 소리를 옮겼으면 영상도 그 자리로). 소리가 영상보다 길어 영상 끝을 지나면 영상을 끝으로 옮겨 세운다
 */
export function planSync({
  video,
  sound,
  soundPlaying,
  duration,
  sinceSeekMs,
}: SyncInput): SyncPlan {
  if (Number.isFinite(duration) && duration > 0 && sound >= duration - END)
    return { seekTo: video < duration - END ? duration : null, rate: 1, play: false }
  const drift = video - sound
  const settled = sinceSeekMs >= SETTLE_MS
  if (!soundPlaying)
    return { seekTo: Math.abs(drift) > 0.1 && settled ? sound : null, rate: 1, play: false }
  // 우리가 옮겨 놓은 앞 정도로 앞서 있으면 그 자리에 세워 두고 소리가 닿을 때 튼다(되돌아 옮기면 다시 받느라 멈칫한다)
  if (drift > HOLD_MIN && drift < HOLD_MAX)
    return { seekTo: null, rate: 1, play: false, wakeInMs: Math.round(drift * 1000) }
  // 뒤처졌거나 훌쩍 앞서 있으면 소리보다 조금 앞으로 옮겨 거기서 기다린다(옮기는 동안 소리가 흐른다)
  if (Math.abs(drift) > JUMP)
    return settled
      ? { seekTo: sound + AHEAD, rate: 1, play: false }
      : { seekTo: null, rate: 1, play: true }
  if (Math.abs(drift) > NEAR) {
    // 어긋난 만큼 빠르게 · 느리게 - 0.05 단위로 끊어 매 걸음 속도를 바꾸지 않는다
    const nudge = Math.round(Math.min(NUDGE_MAX, Math.abs(drift) * GAIN) * 20) / 20
    return { seekTo: null, rate: drift > 0 ? 1 - nudge : 1 + nudge, play: true }
  }
  return { seekTo: null, rate: 1, play: true }
}

export type FollowVideo = Pick<
  HTMLMediaElement,
  | 'currentTime'
  | 'duration'
  | 'paused'
  | 'seeking'
  | 'readyState'
  | 'playbackRate'
  | 'play'
  | 'pause'
>
export type SoundClock = { position: () => number; playing: () => boolean }

/**
 * 음소거 영상이 소리(`sound`)를 따라가게 한다 - 바로 한 번, 그 뒤 `intervalMs`(기본 250ms)마다 어긋남을 재서 `planSync` 대로 한다.
 * 메타데이터가 아직 없으면(`readyState < 1`) 재지도 옮기지도 않는다(붙일 때 정한 시작 자리를 되돌리지 않게).
 * `onSynced` 는 영상이 소리 자리의 프레임을 가졌는지(화면이 포스터를 걷어도 되는지)가 바뀔 때 부른다.
 * 브라우저가 음소거 영상의 `play()` 를 거절하면(`NotAllowedError` - 아이폰 저전력 모드) 따라가기를 멈추고 `onBlocked(resume)` 을 부른다:
 * `resume` 을 사용자 손짓 안에서 부르면 바로 `play()` 를 걸고 되면 다시 따라가며 `onBlocked(null)` 을 부른다. 돌려받은 함수가 멈추고 속도를 1 로 돌린다
 */
export function followSound(
  video: FollowVideo,
  sound: SoundClock,
  {
    intervalMs = 250,
    onSynced,
    onBlocked,
  }: {
    intervalMs?: number
    onSynced?: (synced: boolean) => void
    onBlocked?: (resume: (() => void) | null) => void
  } = {},
): () => void {
  let lastSeek = -Infinity
  let synced: boolean | null = null
  let wake: ReturnType<typeof setTimeout> | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let stopped = false
  const setSynced = (on: boolean) => {
    if (on === synced) return
    synced = on
    onSynced?.(on)
  }
  const refused = (error: unknown) =>
    (error as { name?: string } | null)?.name === 'NotAllowedError'
  const block = () => {
    if (stopped || timer === undefined) return
    halt()
    setSynced(false)
    onBlocked?.(resume)
  }
  const halt = () => {
    clearInterval(timer)
    timer = undefined
    clearTimeout(wake)
  }
  const resume = () => {
    if (stopped || timer !== undefined) return
    // 손짓 안에서 바로 건다 - 되면 다시 따라간다
    video.play()?.then(
      () => {
        if (stopped || timer !== undefined) return
        onBlocked?.(null)
        start()
      },
      () => {},
    )
  }
  const tick = () => {
    // 옮기는 중에는 재도 의미가 없다. 메타데이터가 오기 전에는 옮겨도 시작 자리가 되돌린다
    if (video.seeking) return
    if (video.readyState < 1) return setSynced(false)
    const at = sound.position()
    const plan = planSync({
      video: video.currentTime,
      sound: at,
      soundPlaying: sound.playing(),
      duration: video.duration,
      sinceSeekMs: Date.now() - lastSeek,
    })
    setSynced(video.readyState >= 2 && Math.abs(video.currentTime - at) <= JUMP)
    if (plan.seekTo !== null) {
      video.currentTime = plan.seekTo
      lastSeek = Date.now()
    }
    if (video.playbackRate !== plan.rate) video.playbackRate = plan.rate
    // hls.js 가 붙이며 먼저 건 play() 가 끊겼어도 다음 걸음에 다시 건다. 브라우저가 거절하면(`NotAllowedError`) 되풀이하지 않고 손짓을 기다린다
    if (plan.play && video.paused)
      void video.play()?.catch((error) => {
        if (refused(error)) block()
      })
    else if (!plan.play && !video.paused) video.pause()
    // 앞서 기다리는 중 - 소리가 닿는 때에 맞춰 다시 잰다(250ms 걸음을 기다리면 그만큼 늦게 튼다)
    clearTimeout(wake)
    if (plan.wakeInMs !== undefined && plan.wakeInMs < intervalMs)
      wake = setTimeout(tick, plan.wakeInMs)
  }
  const start = () => {
    timer = setInterval(tick, intervalMs)
    tick()
  }
  start()
  return () => {
    stopped = true
    halt()
    video.playbackRate = 1
  }
}
