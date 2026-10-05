import type { BoardApi } from './boardApi'
import type { BoardId, CommentListParams, PostListParams } from './types'

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
