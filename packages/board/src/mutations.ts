import { ApiRequestError, ErrorCodes, isErrorCode } from '@skeleton/api-client'
import type { ApiPageResponse } from '@skeleton/api-client'
import type { MutationOptions, QueryClient } from '@tanstack/react-query'
import type { BoardApi } from './boardApi'
import { boardKeys } from './queries'
import type {
  Board,
  BoardPatch,
  BoardId,
  Comment,
  CommentInput,
  CommentPatch,
  CommentStatus,
  GuestOptions,
  RevisionDecision,
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

/**
 * 보는 사이 바뀌었다는 오류 - 판의 버전이 달라졌거나(409 BOARD.REVISION_CHANGED) 대상이 이미 공개를 떠났다(404: 글 · 댓글이 가려지거나 지워짐).
 * 화면은 목록을 다시 불러 새 판 · 새 상태를 본 뒤 결정하게 안내한다.
 */
export function isRevisionStale(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    (isErrorCode(error, ErrorCodes.BOARD_REVISION_CHANGED) ||
      isErrorCode(error, ErrorCodes.BOARD_POST_NOT_FOUND) ||
      isErrorCode(error, ErrorCodes.BOARD_COMMENT_NOT_FOUND))
  )
}

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

/** 오래된 화면에서 낸 결정 · 수정이 거절되면 글 상세 · 목록을 다시 불러 지금 상태를 보게 한다 */
function refreshStalePost(client: QueryClient, code: string, id: BoardId, error: unknown) {
  if (!isRevisionStale(error)) return
  void client.invalidateQueries({ queryKey: boardKeys.post(code, id) })
  void client.invalidateQueries({ queryKey: boardKeys.postLists(code) })
}

/** 로그인하지 않은 사람은 변수에 `guestSecret` 을 함께 준다(헤더로만 나간다) */
export function updatePostMutation(
  client: QueryClient,
  api: BoardApi,
  code: string,
  id: BoardId,
): MutationOptions<PostDetail, Error, PostPatch & GuestOptions> {
  return {
    mutationFn: ({ guestSecret, ...patch }) => api.updatePost(code, id, patch, { guestSecret }),
    onSuccess: (post) => {
      keepDetail(client, code, post)
      void client.invalidateQueries({ queryKey: boardKeys.postLists(code) })
    },
    onError: (error) => refreshStalePost(client, code, id, error),
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

/** 승인 · 거절과 함께 보내는, 본 판의 버전(`pendingRevision.submittedAt`) */
export type RevisionDecisionInput = { decision: RevisionDecision; submittedAt: string }

/** 운영자의 고친 글 승인 · 거절 */
export function decidePostRevisionMutation(
  client: QueryClient,
  api: BoardApi,
  code: string,
  id: BoardId,
): MutationOptions<PostDetail, Error, RevisionDecisionInput> {
  return {
    mutationFn: ({ decision, submittedAt }) =>
      api.decidePostRevision(code, id, decision, submittedAt),
    onSuccess: (post) => {
      keepDetail(client, code, post)
      void client.invalidateQueries({ queryKey: boardKeys.postLists(code) })
    },
    onError: (error) => refreshStalePost(client, code, id, error),
  }
}

/** 운영자의 게시판 이름 · 설명 · 설정 고치기 */
export function updateBoardMutation(
  client: QueryClient,
  api: BoardApi,
  code: string,
): MutationOptions<Board, Error, BoardPatch> {
  return {
    mutationFn: (patch) => api.updateBoard(code, patch),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: boardKeys.boards() })
    },
  }
}

/** 글 id, 또는 비회원이 비밀을 함께 줄 때 `{ id, guestSecret }` */
export type RemoveVariables = BoardId | ({ id: BoardId } & GuestOptions)
const asRemove = (v: RemoveVariables) => (typeof v === 'object' ? v : { id: v })

export function removePostMutation(
  client: QueryClient,
  api: BoardApi,
  code: string,
): MutationOptions<void, Error, RemoveVariables> {
  return {
    mutationFn: (v) => {
      const { id, guestSecret } = asRemove(v)
      return api.removePost(code, id, { guestSecret })
    },
    onSuccess: (_, v) => {
      const { id } = asRemove(v)
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
    onSuccess: (created) => {
      // 댓글 수만 로컬에서 +1 — 상세 · 목록을 다시 가져오면 조회수가 오른다. 승인 대기 댓글은 세지 않는다(서버도 승인 때 센다)
      if (created.status === 'PUBLISHED') {
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
      }
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
    // 보는 사이 바뀐 댓글(409 · 404) - 스레드를 다시 불러 지금 상태를 보여 준다
    onError: (error) => {
      if (isRevisionStale(error))
        void client.invalidateQueries({ queryKey: boardKeys.comments(code, postId) })
    },
  }
}

/** 변수의 `guestSecret` 은 비회원이 자기(글의) 비밀을 증명할 때만 */
export const updateCommentMutation = (
  client: QueryClient,
  api: BoardApi,
  code: string,
  postId: BoardId,
) =>
  refetchComments(
    client,
    code,
    postId,
    ({ id, guestSecret, ...patch }: { id: BoardId } & CommentPatch & GuestOptions) =>
      api.updateComment(code, postId, id, patch, { guestSecret }),
  )

export const removeCommentMutation = (
  client: QueryClient,
  api: BoardApi,
  code: string,
  postId: BoardId,
) =>
  refetchComments(client, code, postId, (v: RemoveVariables) => {
    const { id, guestSecret } = asRemove(v)
    return api.removeComment(code, postId, id, { guestSecret })
  })

/** 운영자 · 댓글을 관리하는 글 주인의 승인(`PUBLISHED`) · 가리기(`HIDDEN`) · (운영자) 삭제 */
export const moderateCommentMutation = (
  client: QueryClient,
  api: BoardApi,
  code: string,
  postId: BoardId,
) =>
  refetchComments(
    client,
    code,
    postId,
    ({ id, status, guestSecret }: { id: BoardId; status: CommentStatus } & GuestOptions) =>
      api.moderateComment(code, postId, id, { status }, { guestSecret }),
  )

/** 고친 댓글 승인 · 거절 */
export const decideCommentRevisionMutation = (
  client: QueryClient,
  api: BoardApi,
  code: string,
  postId: BoardId,
) =>
  refetchComments(
    client,
    code,
    postId,
    ({
      id,
      decision,
      submittedAt,
      guestSecret,
    }: { id: BoardId; decision: RevisionDecision; submittedAt: string } & GuestOptions) =>
      api.decideCommentRevision(code, postId, id, decision, submittedAt, { guestSecret }),
  )
