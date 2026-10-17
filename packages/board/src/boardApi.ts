import { newIdempotencyKey, type ApiClient, type ApiPageResponse } from '@skeleton/api-client'
import type {
  Board,
  BoardConfig,
  BoardPatch,
  BoardId,
  BoardInput,
  Comment,
  CommentInput,
  CommentListParams,
  CommentPatch,
  CommentQueueParams,
  CommentStatus,
  CommentWithReplies,
  PostDetail,
  PostInput,
  PostListParams,
  PostModeration,
  PostPatch,
  GuestOptions,
  PostSummary,
  ReactionState,
  RevisionDecision,
  ReactionTarget,
  ReactionType,
} from './types'

/** 비밀은 헤더로만 — 본문 · 주소 · 쿠키에 두지 않는다(서버 `X-Board-Guest-Secret`). 로그인한 사람은 보내지 않는다 */
export const GUEST_SECRET_HEADER = 'X-Board-Guest-Secret'

const guestHeaders = (secret?: string) => (secret ? { [GUEST_SECRET_HEADER]: secret } : undefined)

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
  /** `PATCH {basePath}/{code}` — 운영자만. 보낸 설정 칸만 바뀐다 */
  updateBoard(code: string, patch: BoardPatch): Promise<Board>
  /** `GET {basePath}/{code}/posts` — 페이지 envelope(`pagination.totalPages`). 고정 글이 항상 앞 */
  listPosts(code: string, params?: PostListParams): Promise<ApiPageResponse<PostSummary>>
  /** `GET {basePath}/{code}/posts/{id}` — 서버가 조회수를 한 번 올린다 */
  getPost(code: string, id: BoardId): Promise<PostDetail>
  /** `POST {basePath}/{code}/posts` — `input.guest` 가 있으면 로그인 없이(이름은 본문, 비밀은 헤더) */
  createPost(code: string, input: PostInput, options?: CreateOptions): Promise<PostDetail>
  /** `PATCH {basePath}/{code}/posts/{id}` — 주인 또는 운영자, 비회원 작성자는 `guestSecret`. 승인 대상이면 응답이 공개본 + `pendingRevision` */
  updatePost(
    code: string,
    id: BoardId,
    patch: PostPatch,
    options?: GuestOptions,
  ): Promise<PostDetail>
  /** `DELETE {basePath}/{code}/posts/{id}` — 204, 서버는 소프트 삭제 */
  removePost(code: string, id: BoardId, options?: GuestOptions): Promise<void>
  /** `PUT {basePath}/{code}/posts/{id}/revision` — 운영자만(고친 글 승인 · 거절) */
  decidePostRevision(code: string, id: BoardId, decision: RevisionDecision): Promise<PostDetail>
  /** `PUT {basePath}/{code}/posts/{id}/moderation` — 운영자만(숨김 · 복구 · 고정) */
  moderatePost(code: string, id: BoardId, moderation: PostModeration): Promise<PostDetail>
  /** `GET {basePath}/{code}/posts/{postId}/comments` — 최상위 댓글 단위 페이지 + 각 자손(평평하게) */
  listComments(
    code: string,
    postId: BoardId,
    params?: CommentListParams,
  ): Promise<ApiPageResponse<CommentWithReplies>>
  /** `GET …/comments?status=PENDING` — 승인 대기 댓글(오래된 순 평평하게), 관리하는 쪽만 */
  listPendingComments(
    code: string,
    postId: BoardId,
    params?: CommentQueueParams,
    options?: GuestOptions,
  ): Promise<ApiPageResponse<Comment>>
  /** `GET …/comments?revision=pending` — 고친 댓글(공개본 + `pendingRevision`), 관리하는 쪽만 */
  listCommentRevisions(
    code: string,
    postId: BoardId,
    params?: CommentQueueParams,
    options?: GuestOptions,
  ): Promise<ApiPageResponse<Comment>>
  /** `POST …/comments` — `parentId` 가 있으면 대댓글 */
  createComment(
    code: string,
    postId: BoardId,
    input: CommentInput,
    options?: CreateOptions,
  ): Promise<Comment>
  /** `PATCH …/comments/{id}` — 주인만(비회원은 `guestSecret`) */
  updateComment(
    code: string,
    postId: BoardId,
    id: BoardId,
    input: CommentPatch,
    options?: GuestOptions,
  ): Promise<Comment>
  /** `DELETE …/comments/{id}` — 204, 소프트 삭제(자리는 남고 본문만 null) */
  removeComment(code: string, postId: BoardId, id: BoardId, options?: GuestOptions): Promise<void>
  /** `PUT …/comments/{id}/moderation` — 운영자 · 댓글을 관리하는 글 주인(비회원 글 주인은 `guestSecret`). `PUBLISHED` 가 승인 */
  moderateComment(
    code: string,
    postId: BoardId,
    id: BoardId,
    moderation: { status: CommentStatus },
    options?: GuestOptions,
  ): Promise<Comment>
  /** `PUT …/comments/{id}/revision` — 고친 댓글 승인 · 거절, 관리하는 쪽만 */
  decideCommentRevision(
    code: string,
    postId: BoardId,
    id: BoardId,
    decision: RevisionDecision,
    options?: GuestOptions,
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

/** 비회원이면 이름 · 캡차 토큰을 본문에 싣는다(비밀은 싣지 않는다 — 헤더로만) */
const guestBody = <T extends object>(body: T, guest?: { name?: string; captchaToken?: string }) =>
  guest ? defined({ ...body, guestName: guest.name, captchaToken: guest.captchaToken }) : body

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
    updateBoard: (code, patch) =>
      client.value<Board>(`${base}/${enc(code)}`, { method: 'PATCH', json: patch }),
    createPost: (code, input, options) => {
      const { guest, ...rest } = input
      return client.value<PostDetail>(`${base}/${enc(code)}/posts`, {
        method: 'POST',
        json: guestBody(rest, guest),
        headers: guestHeaders(guest?.secret),
        idempotencyKey: create(options),
      })
    },
    updatePost: (code, id, patch, options) =>
      client.value<PostDetail>(post(code, id), {
        method: 'PATCH',
        json: patch,
        headers: guestHeaders(options?.guestSecret),
      }),
    removePost: (code, id, options) =>
      client.noContent(post(code, id), {
        method: 'DELETE',
        headers: guestHeaders(options?.guestSecret),
      }),
    decidePostRevision: (code, id, decision) =>
      client.value<PostDetail>(`${post(code, id)}/revision`, { method: 'PUT', json: { decision } }),
    moderatePost: (code, id, moderation) =>
      client.value<PostDetail>(`${post(code, id)}/moderation`, { method: 'PUT', json: moderation }),
    listComments: (code, postId, params = {}) =>
      client.page<CommentWithReplies>(`${post(code, postId)}/comments`, {
        params: defined(params),
      }),
    listPendingComments: (code, postId, params = {}, options) =>
      client.page<Comment>(`${post(code, postId)}/comments`, {
        params: defined({ ...params, status: 'PENDING' }),
        headers: guestHeaders(options?.guestSecret),
      }),
    listCommentRevisions: (code, postId, params = {}, options) =>
      client.page<Comment>(`${post(code, postId)}/comments`, {
        params: defined({ ...params, revision: 'pending' }),
        headers: guestHeaders(options?.guestSecret),
      }),
    createComment: (code, postId, input, options) => {
      const { guest, ...rest } = input
      return client.value<Comment>(`${post(code, postId)}/comments`, {
        method: 'POST',
        json: guestBody(rest, guest),
        headers: guestHeaders(guest?.secret),
        idempotencyKey: create(options),
      })
    },
    updateComment: (code, postId, id, input, options) =>
      client.value<Comment>(comment(code, postId, id), {
        method: 'PATCH',
        json: input,
        headers: guestHeaders(options?.guestSecret),
      }),
    removeComment: (code, postId, id, options) =>
      client.noContent(comment(code, postId, id), {
        method: 'DELETE',
        headers: guestHeaders(options?.guestSecret),
      }),
    moderateComment: (code, postId, id, moderation, options) =>
      client.value<Comment>(`${comment(code, postId, id)}/moderation`, {
        method: 'PUT',
        json: moderation,
        headers: guestHeaders(options?.guestSecret),
      }),
    decideCommentRevision: (code, postId, id, decision, options) =>
      client.value<Comment>(`${comment(code, postId, id)}/revision`, {
        method: 'PUT',
        json: { decision },
        headers: guestHeaders(options?.guestSecret),
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
