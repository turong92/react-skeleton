/*
 * 백엔드 `modules/board`(kotlin-skeleton)의 HTTP 계약 — 필드 이름 · 널 허용을 그대로 옮긴다. 정본은 백엔드의 DTO 이고,
 * 이 파일은 그 거울이다(README 「어느 백엔드와 짝인가」). 시각(`Instant`)은 ISO 문자열.
 */

/** 글 · 댓글의 id — 서버(Kotlin `Long`)가 JSON 숫자로 준다 */
export type BoardId = number

/** 반응 종류 코드(`LIKE` · `DISLIKE` · `EMPATHY` …) — 서버 설정 `skeleton.board.reaction.types` 가 정한다. 패키지는 코드를 모른다 */
export type ReactionType = string

/** 한 사람이 한 대상에 반응을 하나만(`SINGLE`, 기본) · 종류마다 하나씩 여럿(`PER_TYPE`) */
export type ReactionMode = 'SINGLE' | 'PER_TYPE'
export const REACTION_MODES: readonly ReactionMode[] = ['SINGLE', 'PER_TYPE']

/** `GET /boards/config` — 화면이 그리는 모든 것(반응 종류 · 길이 한도 · 내가 운영자인가)이 여기서 온다 */
export type BoardConfig = {
  reactionTypes: ReactionType[]
  reactionMode: ReactionMode
  /** 댓글 깊이의 최대값(0 = 최상위). 기본 2 → 깊이 0 · 1 · 2 */
  maxCommentDepth: number
  titleMaxLength: number
  bodyMaxLength: number
  commentMaxLength: number
  maxPageSize: number
  /** 호출자가 운영자 역할인가 — 숨김 · 고정 · 게시판 만들기 버튼의 근거 */
  canModerate: boolean
  /** true 면 글 · 댓글을 쓸 때 `authorId` 가 필수 — 서버가 작성자를 고르지 않는다(없는 서버 · 옛 서버는 undefined = 아니오) */
  authorRequired?: boolean
}

export type Board = {
  code: string
  name: string
  description: string | null
  postCount: number
  /** 백엔드 `BoardResponse.createdAt`(계약 문서에는 없다) */
  createdAt?: string
}

export type BoardInput = { code: string; name: string; description?: string }

export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'DELETED'
export type CommentStatus = 'PUBLISHED' | 'HIDDEN' | 'DELETED'

/** 반응 집계 — `counts` 는 종류별 개수(없는 종류는 0 으로 읽는다), `myReactions` 는 내가 누른 종류들 */
export type ReactionState = { counts: Record<ReactionType, number>; myReactions: ReactionType[] }

export type PostSummary = {
  id: BoardId
  boardCode: string
  /** 작성자 id — 작성자 프로필을 쓰는 서버에서는 계정 id 가 아니다. 소유 판정에 쓰지 않는다(`mine`) */
  authorId: string
  /** 내 글인가 — 서버가 본인 응답에만 참으로 싣는다. 옛 서버는 없음(`isOwn` 이 `authorId` 로 대신 판정) */
  mine?: boolean
  /** 작성자 닉네임 — 닉네임이 없는 계정이거나 옛 서버면 null · 없음. 화면은 계정 id 를 그리지 않고 `authorName` 만 쓴다 */
  authorName?: string | null
  /** 작성자가 탈퇴했는가(그때 `authorId` 는 `deleted:<해시>`) */
  authorDeleted?: boolean
  /** 서버가 붙이는 4자리 꼬리표 — 닉네임 뒤 `#4821`. 꼬리표 방식이 꺼진 서버 · 옛 서버는 null · 없음 */
  authorTag?: string | null
  title: string
  excerpt: string
  status: PostStatus
  pinned: boolean
  viewCount: number
  commentCount: number
  reactionCounts: Record<ReactionType, number>
  myReactions: ReactionType[]
  attachmentCount: number
  createdAt: string
  updatedAt: string
}

/** 글 한 건 — 목록 줄 + 본문 · 첨부(스토리지 키) */
export type PostDetail = PostSummary & { body: string; attachments: string[] }

export type PostInput = {
  title: string
  body: string
  attachments?: string[]
  /** 만들 때 기본 `PUBLISHED`. 고칠 때는 주인이 `DRAFT` ↔ `PUBLISHED` */
  status?: 'DRAFT' | 'PUBLISHED'
  /** 만들 때만 — `BoardConfig.authorRequired` 인 서버는 필수, 고칠 때는 보내지 않는다(작성자는 불변) */
  authorId?: string
}
export type PostPatch = Partial<Omit<PostInput, 'authorId'>>
export type PostModeration = { status?: 'PUBLISHED' | 'HIDDEN' | 'DELETED'; pinned?: boolean }

export const POST_SORTS = ['latest', 'reactions', 'comments'] as const
export type PostSort = (typeof POST_SORTS)[number]
export const COMMENT_SORTS = ['oldest', 'latest', 'reactions'] as const
export type CommentSort = (typeof COMMENT_SORTS)[number]

export type PostListParams = {
  page?: number
  size?: number
  sort?: PostSort
  q?: string
  /** 이 종류의 개수로 정렬(`sort=reactions` 와 함께) */
  reaction?: ReactionType
  /** 운영자만 — 기본은 `PUBLISHED` */
  status?: PostStatus
  /** true 면 내 글만(초안 포함) — 백엔드의 `mine`(계약 문서에는 없지만 컨트롤러가 받는다) */
  mine?: boolean
}
export type CommentListParams = { page?: number; size?: number; sort?: CommentSort }

/** `body` 는 `PUBLISHED` 가 아니면 모두에게 null — 자리 표시는 화면이 `status` 로 고른다 */
export type Comment = {
  id: BoardId
  postId: BoardId
  parentId: BoardId | null
  rootId: BoardId
  /** 0 = 최상위 */
  depth: number
  authorId: string
  /** 내 댓글인가 — 글의 `mine` 과 같다 */
  mine?: boolean
  /** 작성자 닉네임 — 글의 `authorName` 과 같다 */
  authorName?: string | null
  authorDeleted?: boolean
  authorTag?: string | null
  body: string | null
  status: CommentStatus
  reactionCounts: Record<ReactionType, number>
  myReactions: ReactionType[]
  /** 모든 자손의 수 */
  replyCount: number
  createdAt: string
  updatedAt: string
}

/** 계약의 `CommentThread` — 최상위 댓글 + 그 아래 **모든** 자손(평평하게, 오래된 순). 자손의 `replies` 는 항상 빈 배열 — 중첩은 `nestThread` 가 만든다 */
export type CommentWithReplies = Comment & { replies: Comment[] }

export type CommentInput = {
  body: string
  parentId?: BoardId
  /** 만들 때만 — `BoardConfig.authorRequired` 인 서버는 필수 */
  authorId?: string
}

/** 반응 대상 — 글 하나 또는 그 글의 댓글 하나 */
export type ReactionTarget =
  | { kind: 'post'; postId: BoardId }
  | { kind: 'comment'; postId: BoardId; commentId: BoardId }
