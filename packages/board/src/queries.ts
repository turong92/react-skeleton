import { ApiRequestError } from '@skeleton/api-client'
import type { BoardApi } from './boardApi'
import type {
  BoardId,
  CommentListParams,
  CommentQueueParams,
  GuestOptions,
  PostListParams,
} from './types'

/**
 * 키는 `board` 한 뿌리 아래 층층이 — 무효화 · 캐시 패치가 이 접두어로 한다.
 * 글 목록과 글 상세는 `posts(code)` 아래 갈라지고(`postLists` · `post`), 댓글은 글마다 `comments(code, postId)` 아래다.
 */
export const boardKeys = {
  all: ['board'] as const,
  config: () => [...boardKeys.all, 'config'] as const,
  boards: () => [...boardKeys.all, 'boards'] as const,
  board: (code: string) => [...boardKeys.boards(), code] as const,
  posts: (code: string) => [...boardKeys.all, 'posts', code] as const,
  postLists: (code: string) => [...boardKeys.posts(code), 'list'] as const,
  postList: (code: string, params: PostListParams = {}) =>
    [...boardKeys.postLists(code), params] as const,
  post: (code: string, id: BoardId) => [...boardKeys.posts(code), 'detail', id] as const,
  comments: (code: string, postId: BoardId) =>
    [...boardKeys.all, 'comments', code, postId] as const,
  commentList: (code: string, postId: BoardId, params: CommentListParams = {}) =>
    [...boardKeys.comments(code, postId), params] as const,
  /** 승인 대기 · 고친 댓글 목록 — 댓글 키 아래라 댓글을 바꾸면 함께 무효화된다. 비밀은 키에 넣지 않는다 */
  pendingComments: (code: string, postId: BoardId, params: CommentQueueParams = {}) =>
    [...boardKeys.comments(code, postId), 'pending', params] as const,
  commentRevisions: (code: string, postId: BoardId, params: CommentQueueParams = {}) =>
    [...boardKeys.comments(code, postId), 'revisions', params] as const,
}

/** 쿼리 정의(키 + 함수)를 훅과 따로 둔다 — 가짜 api 로 테스트하고 서버 렌더의 `prefetch` 에도 쓴다 */
export const configQuery = (api: BoardApi) => ({
  queryKey: boardKeys.config(),
  queryFn: () => api.getConfig(),
})
export const boardsQuery = (api: BoardApi) => ({
  queryKey: boardKeys.boards(),
  queryFn: () => api.listBoards(),
})
export const boardQuery = (api: BoardApi, code: string) => ({
  queryKey: boardKeys.board(code),
  queryFn: () => api.getBoard(code),
})
export const postListQuery = (api: BoardApi, code: string, params: PostListParams = {}) => ({
  queryKey: boardKeys.postList(code, params),
  queryFn: () => api.listPosts(code, params),
})
export const postQuery = (api: BoardApi, code: string, id: BoardId) => ({
  queryKey: boardKeys.post(code, id),
  queryFn: () => api.getPost(code, id),
})
export const commentListQuery = (
  api: BoardApi,
  code: string,
  postId: BoardId,
  params: CommentListParams = {},
) => ({
  queryKey: boardKeys.commentList(code, postId, params),
  queryFn: () => api.listComments(code, postId, params),
})

/**
 * 비밀 헤더를 싣는 읽기(승인 대기 · 고친 댓글)는 4xx 를 다시 시도하지 않는다 - 틀린 비밀은 시도마다 서버의 「틀린 시도」 한도(기본 10분에 10번)를 먹고,
 * 기본 재시도(세 번)가 한 번의 실수를 네 번으로 세어 글의 고치기 · 지우기까지 잠글 수 있다. 5xx · 네트워크 오류만 두 번까지 다시 한다.
 */
export const retryUnlessClientError = (failureCount: number, error: unknown): boolean => {
  if (
    error instanceof ApiRequestError &&
    error.apiError.status >= 400 &&
    error.apiError.status < 500
  )
    return false
  return failureCount < 2
}

/** 승인 대기 댓글 — 관리하는 쪽만(비회원 글 주인은 `guestSecret`) */
export const pendingCommentsQuery = (
  api: BoardApi,
  code: string,
  postId: BoardId,
  params: CommentQueueParams = {},
  options: GuestOptions = {},
) => ({
  queryKey: boardKeys.pendingComments(code, postId, params),
  queryFn: () => api.listPendingComments(code, postId, params, options),
  retry: retryUnlessClientError,
})
/** 고친 댓글(공개본 + `pendingRevision`) — 관리하는 쪽만 */
export const commentRevisionsQuery = (
  api: BoardApi,
  code: string,
  postId: BoardId,
  params: CommentQueueParams = {},
  options: GuestOptions = {},
) => ({
  queryKey: boardKeys.commentRevisions(code, postId, params),
  queryFn: () => api.listCommentRevisions(code, postId, params, options),
  retry: retryUnlessClientError,
})
