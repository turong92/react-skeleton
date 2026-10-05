import type { ApiPageResponse } from '@skeleton/api-client'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { boardKeys } from './queries'
import type {
  CommentWithReplies,
  PostDetail,
  PostSummary,
  ReactionState,
  ReactionTarget,
} from './types'

/*
 * 반응을 캐시 곳곳에 고쳐 쓰는 일 — 글 하나의 반응은 상세와 모든 목록 쪽에, 댓글 하나의 반응은 그 글의 댓글 목록(최상위 · 자손)에 있다.
 * 낙관적 갱신(reactionMutation.ts)이 「고치기 · 되돌리기 · 서버 값으로 덮기」를 이 함수들로 한다.
 */
type Reactive = { reactionCounts: ReactionState['counts']; myReactions: string[] }
type Update = (state: ReactionState) => ReactionState
export type Snapshot = Array<[QueryKey, unknown]>

const patch = <T extends Reactive>(item: T, update: Update): T => {
  const next = update({ counts: item.reactionCounts, myReactions: item.myReactions })
  return { ...item, reactionCounts: next.counts, myReactions: next.myReactions }
}

/** 이 대상의 반응이 들어 있는 캐시의 뿌리 키들 */
export const reactionRoots = (code: string, target: ReactionTarget): QueryKey[] =>
  target.kind === 'post'
    ? [boardKeys.post(code, target.postId), boardKeys.postLists(code)]
    : [boardKeys.comments(code, target.postId)]

export function snapshotReactionCaches(
  client: QueryClient,
  code: string,
  target: ReactionTarget,
): Snapshot {
  return reactionRoots(code, target).flatMap((queryKey) => client.getQueriesData({ queryKey }))
}

export function restoreSnapshot(client: QueryClient, snapshot: Snapshot) {
  for (const [key, data] of snapshot) client.setQueryData(key, data)
}

export function updateReactionCaches(
  client: QueryClient,
  code: string,
  target: ReactionTarget,
  update: Update,
) {
  if (target.kind === 'post') {
    const { postId } = target
    client.setQueryData<PostDetail>(
      boardKeys.post(code, postId),
      (data) => data && patch(data, update),
    )
    client.setQueriesData<ApiPageResponse<PostSummary>>(
      { queryKey: boardKeys.postLists(code) },
      (data) =>
        data && {
          ...data,
          values: data.values.map((post) => (post.id === postId ? patch(post, update) : post)),
        },
    )
    return
  }
  const { commentId } = target
  const one = <T extends CommentWithReplies['replies'][number]>(item: T) =>
    item.id === commentId ? patch(item, update) : item
  client.setQueriesData<ApiPageResponse<CommentWithReplies>>(
    { queryKey: boardKeys.comments(code, target.postId) },
    (data) =>
      data && {
        ...data,
        values: data.values.map((root) => ({ ...one(root), replies: root.replies.map(one) })),
      },
  )
}
