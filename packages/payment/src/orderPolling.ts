import type { OrderDetail, OrderStatus } from './ledgerTypes'

/** 첫 되묻기 1초에서 시작해 두 배씩, 이 값에서 멈춘다 */
export const ORDER_POLL_MIN_MS = 1_000
export const ORDER_POLL_MAX_MS = 10_000
/** `CONFIRMING` 을 이만큼(밀리초) 되물어도 안 끝나면 그만 묻는다 — 화면은 「결제 내역에서 다시 볼 수 있어요」로 가 있다(`PaymentResult` 의 `slowAfterMs` 보다 넉넉히 길다) */
export const ORDER_POLL_MAX_DURATION_MS = 5 * 60_000

/** `CONFIRMING`(결제사 승인 결과를 아직 모름)인 동안만 되묻는다 — 간격은 받은 횟수만큼 늘어난다. 끝 상태이거나 아직 못 받았으면 `false` */
export function orderPollInterval(
  status: OrderStatus | undefined,
  answers: number,
): number | false {
  if (status !== 'CONFIRMING') return false
  return Math.min(ORDER_POLL_MIN_MS * 2 ** Math.max(0, answers - 1), ORDER_POLL_MAX_MS)
}

// 쿼리마다 「CONFIRMING 을 몇 번 받았나 · 언제부터」를 기억한다 — 이전 조회나 무효화가 아니라 CONFIRMING 을 받은 횟수만 센다
type Episode = { lastActive: number; lastData: number; answers: number; since: number }
const episodes = new WeakMap<object, Episode>()
// 이 간격보다 오래 아무 일(답도 오류도)이 없었으면(탭이 숨겨졌거나 상한에서 멈췄다가 다시 열림) 새로 시작한다
const EPISODE_GAP_MS = 2 * ORDER_POLL_MAX_MS

export type PollQuery = {
  state: { data: OrderDetail | undefined; dataUpdatedAt: number; errorUpdatedAt?: number }
}

/**
 * 다음 되묻기까지의 간격. 상한은 시계로 잰다(`now() - since`) — 조회가 계속 실패해도 마지막 성공 시각이 멈춰 있을 뿐
 * 상한은 다가온다. 회차 사이의 공백은 성공뿐 아니라 실패도 「일이 있었다」로 친다.
 */
export function pollIntervalOf(
  query: PollQuery,
  maxPollMs: number,
  now: () => number = Date.now,
): number | false {
  const status = query.state.data?.order.status
  if (status !== 'CONFIRMING') {
    episodes.delete(query)
    return false
  }
  const data = query.state.dataUpdatedAt
  const active = Math.max(data, query.state.errorUpdatedAt ?? 0)
  const known = episodes.get(query)
  const episode: Episode =
    !known || active - known.lastActive > EPISODE_GAP_MS
      ? { lastActive: active, lastData: data, answers: 1, since: data }
      : data === known.lastData
        ? { ...known, lastActive: active }
        : { ...known, lastActive: active, lastData: data, answers: known.answers + 1 }
  episodes.set(query, episode)
  if (now() - episode.since >= maxPollMs) return false
  return orderPollInterval(status, episode.answers)
}
