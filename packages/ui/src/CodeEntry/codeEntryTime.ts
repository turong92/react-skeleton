/**
 * 인증번호 남은 시간 계산 — 모두 **절대 시각**(만료 시각)과 **그때그때 읽는 시계**에서 나온다. 1초씩 깎는 카운터가 아니라서 탭이 잠들었다 깨도,
 * 기기 시계가 틀려도(`now` 에 서버 보정 시계를 넘긴다 — `@skeleton/time` `createServerClock`) 맞는다.
 */

/** 만료 시각의 표현 — 서버가 준 ISO 문자열 · `Date` · 에포크 ms */
export type ExpiryInput = number | string | Date

export type TimeStage = 'normal' | 'minute' | 'ten' | 'expired'

/** 에포크 ms 로. 모르는 값 · 없는 값은 null(= 시간 제한을 안 보인다) */
export function expiryMillis(input: ExpiryInput | null | undefined): number | null {
  if (input === null || input === undefined) return null
  const ms =
    input instanceof Date ? input.getTime() : typeof input === 'number' ? input : Date.parse(input)
  return Number.isFinite(ms) ? ms : null
}

/** 남은 초 — 올림(0 은 정말 끝났을 때만) */
export function secondsRemaining(expiresAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000))
}

/** `mm:ss` — 60분을 넘는 값은 분이 계속 커진다(30분 코드는 `30:00`) */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** 알릴 만한 문턱: 60초 이하 · 10초 이하 · 끝 */
export function stageOf(seconds: number): TimeStage {
  if (seconds <= 0) return 'expired'
  if (seconds <= 10) return 'ten'
  if (seconds <= 60) return 'minute'
  return 'normal'
}

const EXPIRED_RECHECK_MS = 2_000

export type WatchOptions = {
  expiresAtMs: number
  /** 시계 — 서버 보정 시계를 넘기면 기기 시계 오차를 뺀다 */
  now: () => number
  onChange: (seconds: number) => void
  /** 탭이 다시 보이면 곧바로 다시 읽는다(기본 `document`) */
  visibility?: EventTarget
}

/**
 * 남은 초가 **바뀔 때** 알린다 — 지금 값을 한 번 부르고, 다음 초 경계까지만 타이머를 걸어 `now()` 로 다시 읽는다(드리프트 없음).
 * 0 이 된 뒤에는 2초마다 느리게 다시 읽는다(시계가 보정되면 시간이 돌아올 수 있다 — 바뀔 때만 알린다). 반환값을 부르면 타이머와 리스너가 없어진다.
 */
export function watchRemaining({
  expiresAtMs,
  now,
  onChange,
  visibility,
}: WatchOptions): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  const target = visibility ?? (typeof document === 'undefined' ? undefined : document)
  let last: number | undefined
  const tick = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    if (stopped) return
    const at = now()
    const left = expiresAtMs - at
    const seconds = secondsRemaining(expiresAtMs, at)
    if (left > 0 || last !== 0) onChange(seconds)
    else if (seconds !== 0) onChange(seconds) // 끝났다고 했는데 시계 보정으로 시간이 돌아왔다
    last = seconds
    // 끝난 뒤에도 느리게 지켜본다 — 서버 시계 표본이 늦게 오면 틀린 시계로 내린 「만료」 판정이 그대로 굳지 않는다
    timer = setTimeout(tick, left > 0 ? left % 1000 || 1000 : EXPIRED_RECHECK_MS)
  }
  target?.addEventListener('visibilitychange', tick)
  tick()
  return () => {
    stopped = true
    if (timer !== undefined) clearTimeout(timer)
    target?.removeEventListener('visibilitychange', tick)
  }
}
