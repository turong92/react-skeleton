import { OPERATOR_REFUND_TIMEOUT_MS } from './adminApi'

/**
 * 직접 환불의 지금 상태 - 모름인가 · 같은 키로 다시 보내는 중인가 · 마지막으로 **보낸** 때(`Date.now()`, 보낸 적이 없으면 0).
 * 유예는 모름이 된 때가 아니라 보낸 때부터 센다: 가장 흔한 모름인 시간 초과는 모름이 됐을 때 이미 환불 호출의 제한 시간만큼 기다린 뒤라서,
 * 모름이 된 때부터 세면 첫 「결제사와 맞추기」는 거의 늘 헛눌림이다. 다시 보내면 보낸 때가 새로 바뀌어 유예도 다시 센다.
 * 다만 보낸 때가 실제로 나간 때가 아닐 수 있어 유예에 바닥을 둔다: `max(보낸 때 + 유예, 모름이 된 때 + {@link UNSURE_FLOOR_MS})`.
 */
export type UnsureState = {
  unsure: boolean
  pending: boolean
  sentAt: number
  /** 모름이 된 때(`Date.now()`) - 보낸 때가 실제로 나간 때가 아닐 수 있어(오프라인으로 멈췄다 나간 변경 · 앱이 켠 `mutations.retry`) 유예의 바닥을 이것에서 센다 */
  unsureAt: number
}

/** 모름이 된 뒤 최소한 기다리는 시간(ms) - 보낸 때 + 유예가 이미 지났어도 이만큼은 둔다. 시간 초과로 모름이 된 보통 경우의 첫 맞추기도 한 번은 문구와 함께 기다린다 */
export const UNSURE_FLOOR_MS = 15_000

/**
 * 「결제사와 맞추기」가 끝난 뒤 모름에 대해 할 일:
 * - `release`: 놓는다 - 모름(잠금 + 든 키)을 놓으면 그 뒤의 환불은 새 의도 - 새 키라, 나가 있던 환불이 있다면 한 번 더 나간다
 * - `hold`: 아직 놓지 않는다(`waitMs` 뒤에 다시 맞추면 놓는다) - 맞추기가 본 장부에 그 환불이 보인다는 보장은 첫 요청이 서버에서 **환불 줄을 만든 뒤**여야 선다.
 *   보낸 지 환불 호출의 제한 시간(`holdMs`)이 안 지났으면 첫 요청이 아직 환불 전 확인 조회 중일 수 있어(맞추기가 먼저 끝나면 화면에 환불 줄이 없다) 놓지 않는다
 * - `none`: 놓을 모름이 없다 - 모름이 아니거나, 같은 키로 다시 보내는 중이거나, 보낸 적이 없다
 */
export type UnsureVerdict =
  | { kind: 'release' }
  | { kind: 'hold'; waitMs: number }
  | { kind: 'none' }

export function unsureVerdict(
  state: UnsureState,
  now: number,
  holdMs: number = OPERATOR_REFUND_TIMEOUT_MS,
  floorMs: number = UNSURE_FLOOR_MS,
): UnsureVerdict {
  if (!state.unsure || state.pending || state.sentAt <= 0) return { kind: 'none' }
  const waitMs = Math.max(state.sentAt + holdMs, state.unsureAt + floorMs) - now
  return waitMs > 0 ? { kind: 'hold', waitMs } : { kind: 'release' }
}
