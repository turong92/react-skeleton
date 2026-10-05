import type { ApiPageResponse } from '@skeleton/api-client'
import type { MutationOptions, QueryClient } from '@tanstack/react-query'
import type { BoardApi } from './boardApi'
import { boardKeys } from './queries'
import type {
  BoardId,
  Comment,
  CommentInput,
  CommentStatus,
  PostDetail,
  PostInput,
  PostModeration,
  PostPatch,
  PostSummary,
} from './types'

/*
 * 글 · 댓글 변경의 「성공하면 무엇을 갱신하는가」 — 훅(hooks.ts)과 따로 둔 옵션 함수라 가짜 api · 실제 QueryClient 로 잰다.
 * 글 상세는 서버가 불러올 때마다 조회수를 올린다 — 그래서 고치기 · 숨기기는 응답으로 캐시를 바꾸고 상세를 다시 가져오지 않는다.
 * 반응의 낙관적 갱신은 reactionMutation.ts.
 */
type Created<T> = { input: T; /** 같은 제출을 다시 보낼 때만 같은 키 */ idempotencyKey?: string }

const keepDetail = (client: QueryClient, code: string, post: PostDetail) =>
  client.setQueryData(boardKeys.post(code, post.id), post)

export function createPostMutation(
  client: QueryClient,
  api: BoardApi,
  code: string,
): MutationOptions<PostDetail, Error, Created<PostInput>> {
  return {
    mutationFn: ({ input, idempotencyKey }) => api.createPost(code, input, { idempotencyKey }),
    onSuccess: (post) => {
      keepDetail(client, code, post)
      void client.invalidateQueries({ queryKey: boardKeys.postLists(code) })
      void client.invalidateQueries({ queryKey: boardKeys.boards() })
    },
  }
}

export function updatePostMutation(
  client: QueryClient,
  api: BoardApi,
  code: string,
  id: BoardId,
): MutationOptions<PostDetail, Error, PostPatch> {
  return {
    mutationFn: (patch) => api.updatePost(code, id, patch),
    onSuccess: (post) => {
      keepDetail(client, code, post)
      void client.invalidateQueries({ queryKey: boardKeys.postLists(code) })
    },
  }
}

/** 운영자의 숨김 · 복구 · 고정 */
export function moderatePostMutation(
  client: QueryClient,
  api: BoardApi,
  code: string,
  id: BoardId,
): MutationOptions<PostDetail, Error, PostModeration> {
  return {
    mutationFn: (moderation) => api.moderatePost(code, id, moderation),
    onSuccess: (post) => {
      keepDetail(client, code, post)
      void client.invalidateQueries({ queryKey: boardKeys.postLists(code) })
    },
  }
}

export function removePostMutation(
  client: QueryClient,
  api: BoardApi,
  code: string,
): MutationOptions<void, Error, BoardId> {
  return {
    mutationFn: (id) => api.removePost(code, id),
    onSuccess: (_, id) => {
      client.removeQueries({ queryKey: boardKeys.post(code, id) })
      void client.invalidateQueries({ queryKey: boardKeys.postLists(code) })
      void client.invalidateQueries({ queryKey: boardKeys.boards() })
    },
  }
}

const bumpComments = (post: PostSummary): PostSummary => ({
  ...post,
  commentCount: post.commentCount + 1,
})

export function createCommentMutation(
  client: QueryClient,
  api: BoardApi,
  code: string,
  postId: BoardId,
): MutationOptions<Comment, Error, Created<CommentInput>> {
  return {
    mutationFn: ({ input, idempotencyKey }) =>
      api.createComment(code, postId, input, { idempotencyKey }),
    onSuccess: () => {
      // 댓글 수만 로컬에서 +1 — 상세 · 목록을 다시 가져오면 조회수가 오른다
      client.setQueryData<PostDetail>(
        boardKeys.post(code, postId),
        (post) => post && { ...post, ...bumpComments(post) },
      )
      client.setQueriesData<ApiPageResponse<PostSummary>>(
        { queryKey: boardKeys.postLists(code) },
        (data) =>
          data && {
            ...data,
            values: data.values.map((post) => (post.id === postId ? bumpComments(post) : post)),
          },
      )
      void client.invalidateQueries({ queryKey: boardKeys.comments(code, postId) })
    },
  }
}

function refetchComments<TVars>(
  client: QueryClient,
  code: string,
  postId: BoardId,
  mutationFn: (variables: TVars) => Promise<unknown>,
): MutationOptions<unknown, Error, TVars> {
  return {
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: boardKeys.comments(code, postId) }),
  }
}

export const updateCommentMutation = (
  client: QueryClient,
  api: BoardApi,
  code: string,
  postId: BoardId,
) =>
  refetchComments(client, code, postId, ({ id, body }: { id: BoardId; body: string }) =>
    api.updateComment(code, postId, id, { body }),
  )

export const removeCommentMutation = (
  client: QueryClient,
  api: BoardApi,
  code: string,
  postId: BoardId,
) => refetchComments(client, code, postId, (id: BoardId) => api.removeComment(code, postId, id))

export const moderateCommentMutation = (
  client: QueryClient,
  api: BoardApi,
  code: string,
  postId: BoardId,
) =>
  refetchComments(client, code, postId, ({ id, status }: { id: BoardId; status: CommentStatus }) =>
    api.moderateComment(code, postId, id, { status }),
  )
