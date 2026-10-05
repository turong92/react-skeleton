import { newIdempotencyKey, type ApiClient, type ApiPageResponse } from '@skeleton/api-client'
import type {
  Board,
  BoardConfig,
  BoardId,
  BoardInput,
  Comment,
  CommentInput,
  CommentListParams,
  CommentStatus,
  CommentWithReplies,
  PostDetail,
  PostInput,
  PostListParams,
  PostModeration,
  PostPatch,
  PostSummary,
  ReactionState,
  ReactionTarget,
  ReactionType,
} from './types'

type BoardClient = Pick<ApiClient, 'value' | 'page' | 'list' | 'noContent'>

/** 만들기에 붙는 `Idempotency-Key` — 같은 제출을 다시 보낼 때(더블클릭 · 재시도)만 같은 키를 넘긴다. 안 주면 새 키 */
export type CreateOptions = { idempotencyKey?: string }

export type BoardApi = {
  /** `GET {basePath}/config` */
  getConfig(): Promise<BoardConfig>
  /** `GET {basePath}` */
  listBoards(): Promise<Board[]>
  /** `GET {basePath}/{code}` */
  getBoard(code: string): Promise<Board>
  /** `POST {basePath}` — 운영자만 */
  createBoard(input: BoardInput, options?: CreateOptions): Promise<Board>
  /** `GET {basePath}/{code}/posts` — 페이지 envelope(`pagination.totalPages`). 고정 글이 항상 앞 */
  listPosts(code: string, params?: PostListParams): Promise<ApiPageResponse<PostSummary>>
  /** `GET {basePath}/{code}/posts/{id}` — 서버가 조회수를 한 번 올린다 */
  getPost(code: string, id: BoardId): Promise<PostDetail>
  /** `POST {basePath}/{code}/posts` */
  createPost(code: string, input: PostInput, options?: CreateOptions): Promise<PostDetail>
  /** `PATCH {basePath}/{code}/posts/{id}` — 주인 또는 운영자 */
  updatePost(code: string, id: BoardId, patch: PostPatch): Promise<PostDetail>
  /** `DELETE {basePath}/{code}/posts/{id}` — 204, 서버는 소프트 삭제 */
  removePost(code: string, id: BoardId): Promise<void>
  /** `PUT {basePath}/{code}/posts/{id}/moderation` — 운영자만(숨김 · 복구 · 고정) */
  moderatePost(code: string, id: BoardId, moderation: PostModeration): Promise<PostDetail>
  /** `GET {basePath}/{code}/posts/{postId}/comments` — 최상위 댓글 단위 페이지 + 각 자손(평평하게) */
  listComments(
    code: string,
    postId: BoardId,
    params?: CommentListParams,
  ): Promise<ApiPageResponse<CommentWithReplies>>
  /** `POST …/comments` — `parentId` 가 있으면 대댓글 */
  createComment(
    code: string,
    postId: BoardId,
    input: CommentInput,
    options?: CreateOptions,
  ): Promise<Comment>
  /** `PATCH …/comments/{id}` — 주인만 */
  updateComment(
    code: string,
    postId: BoardId,
    id: BoardId,
    input: { body: string },
  ): Promise<Comment>
  /** `DELETE …/comments/{id}` — 204, 소프트 삭제(자리는 남고 본문만 null) */
  removeComment(code: string, postId: BoardId, id: BoardId): Promise<void>
  /** `PUT …/comments/{id}/moderation` — 운영자만 */
  moderateComment(
    code: string,
    postId: BoardId,
    id: BoardId,
    moderation: { status: CommentStatus },
  ): Promise<Comment>
  /** `PUT …/reactions {type}` — 글 또는 댓글. 응답은 서버가 센 집계 */
  putReaction(code: string, target: ReactionTarget, type: ReactionType): Promise<ReactionState>
  /** `DELETE …/reactions?type=` — SINGLE 이면 종류를 생략해도 된다 */
  removeReaction(code: string, target: ReactionTarget, type?: ReactionType): Promise<ReactionState>
}

export type BoardApiOptions = {
  /**
   * 게시판 컨트롤러의 경로(기본 `/boards`, `/api/v1` 은 클라이언트의 baseUrl).
   * 백엔드 `modules/board` 의 컨트롤러가 이 경로를 연다 — 앱이 다른 경로로 열었다면 여기서 바꾼다.
   */
  basePath?: string
}

/** 값이 있는 조건만 보낸다 — 빈 검색어 · 정하지 않은 정렬은 서버에 아무 말도 하지 않는다 */
const defined = (params: object) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  )

/** 게시판 HTTP 호출 모음. 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createBoardApi(
  client: BoardClient,
  { basePath = '/boards' }: BoardApiOptions = {},
): BoardApi {
  const base = basePath.replace(/\/+$/, '')
  const enc = encodeURIComponent
  const post = (code: string, id: BoardId) => `${base}/${enc(code)}/posts/${enc(id)}`
  const comment = (code: string, postId: BoardId, id: BoardId) =>
    `${post(code, postId)}/comments/${enc(id)}`
  const reactions = (code: string, target: ReactionTarget) =>
    target.kind === 'post'
      ? `${post(code, target.postId)}/reactions`
      : `${comment(code, target.postId, target.commentId)}/reactions`
  const create = (options?: CreateOptions) => options?.idempotencyKey ?? newIdempotencyKey()

  return {
    getConfig: () => client.value<BoardConfig>(`${base}/config`),
    listBoards: () => client.list<Board>(base),
    getBoard: (code) => client.value<Board>(`${base}/${enc(code)}`),
    createBoard: (input, options) =>
      client.value<Board>(base, { method: 'POST', json: input, idempotencyKey: create(options) }),
    listPosts: (code, params = {}) =>
      client.page<PostSummary>(`${base}/${enc(code)}/posts`, { params: defined(params) }),
    getPost: (code, id) => client.value<PostDetail>(post(code, id)),
    createPost: (code, input, options) =>
      client.value<PostDetail>(`${base}/${enc(code)}/posts`, {
        method: 'POST',
        json: input,
        idempotencyKey: create(options),
      }),
    updatePost: (code, id, patch) =>
      client.value<PostDetail>(post(code, id), { method: 'PATCH', json: patch }),
    removePost: (code, id) => client.noContent(post(code, id), { method: 'DELETE' }),
    moderatePost: (code, id, moderation) =>
      client.value<PostDetail>(`${post(code, id)}/moderation`, { method: 'PUT', json: moderation }),
    listComments: (code, postId, params = {}) =>
      client.page<CommentWithReplies>(`${post(code, postId)}/comments`, {
        params: defined(params),
      }),
    createComment: (code, postId, input, options) =>
      client.value<Comment>(`${post(code, postId)}/comments`, {
        method: 'POST',
        json: input,
        idempotencyKey: create(options),
      }),
    updateComment: (code, postId, id, input) =>
      client.value<Comment>(comment(code, postId, id), { method: 'PATCH', json: input }),
    removeComment: (code, postId, id) =>
      client.noContent(comment(code, postId, id), { method: 'DELETE' }),
    moderateComment: (code, postId, id, moderation) =>
      client.value<Comment>(`${comment(code, postId, id)}/moderation`, {
        method: 'PUT',
        json: moderation,
      }),
    putReaction: (code, target, type) =>
      client.value<ReactionState>(reactions(code, target), { method: 'PUT', json: { type } }),
    removeReaction: (code, target, type) =>
      client.value<ReactionState>(reactions(code, target), {
        method: 'DELETE',
        params: defined({ type }),
      }),
  }
}
