import type { MutationOptions, QueryClient } from '@tanstack/react-query'
import type { BoardApi } from './boardApi'
import {
  reactionRoots,
  restoreSnapshot,
  snapshotReactionCaches,
  updateReactionCaches,
} from './reactionCache'
import type { Snapshot } from './reactionCache'
import { applyReaction, removeReaction } from './reactions'
import type { ReactionMode, ReactionState, ReactionTarget, ReactionType } from './types'

/** `active` 는 누른 뒤의 상태 — true 면 이 종류를 더하고(PUT), false 면 뺀다(DELETE) */
export type ReactionVariables = { target: ReactionTarget; type: ReactionType; active: boolean }

/**
 * 반응 누르기의 낙관적 갱신 — 누르는 순간 화면(상세 · 목록 · 댓글)을 서버가 셀 값으로 먼저 바꾸고(`reactions.ts`),
 * 실패하면 눌렀던 캐시를 그대로 되돌리고, 성공하면 서버가 돌려준 집계로 덮는다. 다시 가져오지 않는다
 * (글 상세를 다시 가져오면 서버가 조회수를 또 올린다).
 */
export function reactionMutationOptions(
  client: QueryClient,
  api: BoardApi,
  code: string,
  mode: ReactionMode,
): MutationOptions<ReactionState, Error, ReactionVariables, { snapshot: Snapshot }> {
  return {
    mutationFn: ({ target, type, active }) =>
      active ? api.putReaction(code, target, type) : api.removeReaction(code, target, type),
    onMutate: async ({ target, type, active }) => {
      await Promise.all(
        reactionRoots(code, target).map((queryKey) => client.cancelQueries({ queryKey })),
      )
      const snapshot = snapshotReactionCaches(client, code, target)
      updateReactionCaches(client, code, target, (state) =>
        active ? applyReaction(state, mode, type) : removeReaction(state, mode, type),
      )
      return { snapshot }
    },
    onError: (_error, _variables, context) => {
      if (context) restoreSnapshot(client, context.snapshot)
    },
    onSuccess: (state, { target }) => updateReactionCaches(client, code, target, () => state),
  }
}
