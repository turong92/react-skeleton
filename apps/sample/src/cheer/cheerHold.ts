import type { OrderFailure } from './checkoutFlow'

/**
 * 「응원하기」를 못 누르는 이유와 그 풀림 - 화면이 타이머 · 문장에 쓰기 전에 가르는 판정이다(시험할 수 있게 화면 밖에 둔다).
 * 요청이 많아 막힌 때(429)는 **풀리는 시각**(`until`, ms)을 들고 있다 - 남은 분 · 초는 문장에 쓰지 않는다(쓰는 순간부터 줄지 않는 숫자다).
 */
export type HoldNotice = { kind: string; until?: number | null }

export type HoldReason = 'unavailable' | 'rateLimited'

/**
 * 지금 단추를 막는 이유, 없으면 `null`. 결제가 꺼져 있거나(`configAvailable === false`) 서버에 결제창 키가 없었으면(`keyMissing` - 화면을 새로 열 때까지)
 * `unavailable` - 둘은 같은 막힘 · 같은 이유다. 다음이 시각이 있는 429(`rateLimited`). 시각이 없는 429 는 막을 시간이 없다.
 * 타이머가 풀리는 시각에 429 안내를 비우니(`noticeAfterOpening`) 이 판정은 시계를 읽지 않는다.
 */
export function holdReasonOf(state: {
  configAvailable: boolean | undefined
  keyMissing: boolean
  notice: HoldNotice | null
}): HoldReason | null {
  if (state.configAvailable === false || state.keyMissing) return 'unavailable'
  const { notice } = state
  if (notice?.kind === 'rateLimited' && notice.until != null) return 'rateLimited'
  return null
}

/** 타이머가 기다릴 시간(ms) - 이미 지났으면 0, 기다릴 것이 없으면 `null` */
export function openingIn(notice: HoldNotice | null, now: number): number | null {
  if (notice?.kind !== 'rateLimited' || notice.until == null) return null
  return Math.max(0, notice.until - now)
}

/** 풀릴 때 비울 안내 - 429 안내는 막힘과 같이 사라진다(단추는 눌리는데 위험 띠만 남지 않게). 시각 없는 429 와 다른 안내는 그대로 */
export function noticeAfterOpening<N extends HoldNotice>(notice: N | null): N | null {
  return notice?.kind === 'rateLimited' && notice.until != null ? null : notice
}

/**
 * 주문을 거절당했을 때 화면이 띄울 안내. 503 `UNAVAILABLE` 도 **안내로 말한다** - 단추를 막지 않는다(결제사가 이 한 번 거절한 것일 수 있다: Paddle 의 거래 만들기 거절 등).
 * 결제창 키가 없는 경우만 `keyMissing` 으로 막는다(그건 서버가 결제창 값을 비웠을 때다).
 */
export function noticeOfOrderFailure(
  failure: OrderFailure,
  error: unknown,
):
  | { kind: 'rateLimited'; until: number | null; error: unknown }
  | { kind: 'unavailable' | 'notOffered' | 'orderFailed'; error: unknown } {
  return failure.kind === 'rateLimited'
    ? { kind: 'rateLimited', until: failure.until, error }
    : { kind: failure.kind, error }
}
