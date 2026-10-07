import type { MutationOptions, QueryClient } from '@tanstack/react-query'
import type { BoardApi } from './boardApi'
import {
  reactionRoots,
  restoreSnapshot,
  snapshotReactionCaches,
  updateReactionCaches,
} from './reactionCache'
import type { Snapshot } from './reactionCache'
import { boardKeys } from './queries'
import { applyReaction, removeReaction } from './reactions'
import type { ReactionMode, ReactionState, ReactionTarget, ReactionType } from './types'

const REACTION_MUTATION_KEY = ['board', 'reaction'] as const

const sameTarget = (a: ReactionTarget, b: ReactionTarget) =>
  a.kind === b.kind &&
  a.postId === b.postId &&
  (a.kind === 'post' || (b.kind === 'comment' && a.commentId === b.commentId))

/** `active` 는 누른 뒤의 상태 — true 면 이 종류를 더하고(PUT), false 면 뺀다(DELETE) */
export type ReactionVariables = { target: ReactionTarget; type: ReactionType; active: boolean }

/**
 * 반응 누르기의 낙관적 갱신 — 누르는 순간 화면(상세 · 목록 · 댓글)을 서버가 셀 값으로 먼저 바꾸고(`reactions.ts`),
 * 실패하면 눌렀던 캐시를 그대로 되돌리고, 성공하면 서버가 돌려준 집계로 덮는다. 다시 가져오지 않는다
 * (글 상세를 다시 가져오면 서버가 조회수를 또 올린다). 끝난 뒤에는 목록만 다시 맞춘다.
 */
export function reactionMutationOptions(
  client: QueryClient,
  api: BoardApi,
  code: string,
  mode: ReactionMode,
): MutationOptions<ReactionState, Error, ReactionVariables, { snapshot: Snapshot }> {
  /** 같은 대상에 아직 서버 답을 기다리는 다른 반응 뮤테이션이 있는가(자기 자신은 뺀다) */
  const othersPending = (target: ReactionTarget) =>
    client.getMutationCache().findAll({
      mutationKey: REACTION_MUTATION_KEY,
      predicate: (mutation) => {
        const variables = mutation.state.variables as ReactionVariables | undefined
        return (
          mutation.state.status === 'pending' &&
          variables !== undefined &&
          sameTarget(variables.target, target)
        )
      },
    }).length - 1
  return {
    mutationKey: REACTION_MUTATION_KEY,
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
    // 서버 답으로 덮는다 — 같은 대상에 더 나중에 누른 것이 아직 진행 중이면 덮지 않는다(그 뒤의 낙관 상태가 낡은 답에 지워진다). 마지막 답이 덮는다
    onSuccess: (state, { target }) => {
      if (othersPending(target) <= 0) updateReactionCaches(client, code, target, () => state)
    },
    // 글의 반응이면 목록만 서버와 다시 맞춘다 — 진행 중이던 목록 GET 이 PUT 보다 먼저 읽어 낡은 수를 남길 수 있다(상세는 조회수가 오르니 다시 가져오지 않는다)
    onSettled: (_state, _error, { target }) => {
      if (target.kind === 'post' && othersPending(target) <= 0)
        void client.invalidateQueries({ queryKey: boardKeys.postLists(code) })
    },
  }
}
