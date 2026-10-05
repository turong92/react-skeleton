import type { ReactionMode, ReactionState, ReactionType } from './types'

/*
 * 서버가 반응을 세는 규칙을 그대로 따라 한 순수 함수 — 낙관적 갱신이 서버의 답과 같은 화면을 먼저 보여 주려고 쓴다.
 * 서버의 `ReactionState` 가 오면 그 값이 이긴다(이 계산은 응답이 오기 전까지의 추측이다).
 *  - SINGLE(기본): PUT 은 내 반응 하나를 `type` 으로 바꾼다. 같은 종류를 또 누르면 아무 일도 없다(멱등).
 *  - PER_TYPE: 종류마다 하나씩 — PUT 은 그 종류를 더하고, 이미 있으면 아무 일도 없다.
 *  - DELETE: 내 것인 종류만 뺀다(SINGLE 은 종류를 생략하면 무엇이든 내 반응을 뺀다). 개수는 0 아래로 내려가지 않는다.
 */

/** 서버가 알려 주지 않은 종류의 개수는 0 */
export const reactionCount = (counts: Record<ReactionType, number>, type: ReactionType): number =>
  counts[type] ?? 0

const shift = (counts: Record<ReactionType, number>, type: ReactionType, by: 1 | -1) => ({
  ...counts,
  [type]: Math.max(0, reactionCount(counts, type) + by),
})

/** 서버의 `PUT …/reactions {type}` */
export function applyReaction(
  state: ReactionState,
  mode: ReactionMode,
  type: ReactionType,
): ReactionState {
  if (state.myReactions.includes(type)) return state
  if (mode === 'PER_TYPE')
    return { counts: shift(state.counts, type, 1), myReactions: [...state.myReactions, type] }
  const cleared = state.myReactions.reduce((counts, mine) => shift(counts, mine, -1), state.counts)
  return { counts: shift(cleared, type, 1), myReactions: [type] }
}

/** 서버의 `DELETE …/reactions?type=` — `type` 이 없으면 내 반응 전부(SINGLE 에서는 그 하나) */
export function removeReaction(
  state: ReactionState,
  _mode: ReactionMode,
  type?: ReactionType,
): ReactionState {
  const removed =
    type === undefined ? state.myReactions : state.myReactions.filter((t) => t === type)
  if (removed.length === 0) return state
  return {
    counts: removed.reduce((counts, mine) => shift(counts, mine, -1), state.counts),
    myReactions: state.myReactions.filter((t) => !removed.includes(t)),
  }
}
