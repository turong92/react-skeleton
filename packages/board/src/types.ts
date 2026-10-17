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
  /** 비회원 쓰기가 켜져 있다(서버 `skeleton.board.guest.enabled`) — 게시판마다 `settings.guestWrite` 가 실제로 정한다. 옛 서버는 undefined = 아니오 */
  guestEnabled?: boolean
  /** 비회원 비밀의 종류 — `PASSWORD`: 사람이 치는 값(저장하지 않는다) · `TOKEN`: 앱이 만든 무작위 값 */
  guestSecret?: GuestSecretKind
  guestNameMaxLength?: number
  /** true 면 비회원의 만들기에 `guest.captchaToken` 이 필요하다(없거나 틀리면 `BOARD.CAPTCHA_FAILED`) */
  captchaRequired?: boolean
  /** 댓글 하나의 첨부 수 상한 — 0 이면 댓글 첨부가 꺼져 있다 */
  commentMaxAttachments?: number
}

export type GuestSecretKind = 'PASSWORD' | 'TOKEN'
export type GuestWrite = 'NONE' | 'COMMENTS' | 'ALL'
/** 승인을 거쳐야 하는 작성자 — OFF 없음 · GUESTS 비회원만 · ALL 운영자 외 모두 */
export type ApprovalMode = 'OFF' | 'GUESTS' | 'ALL'

/** 게시판 설정(서버 `BoardSettings`) — 새 기능은 모두 꺼진 값(NONE · OFF · false)이 기본 */
export type BoardSettings = {
  guestWrite: GuestWrite
  postApproval: ApprovalMode
  commentApproval: ApprovalMode
  /** 글 주인이 자기 글의 댓글을 승인 · 가린다 */
  ownerModeratesComments: boolean
}

/** 운영자의 게시판 고치기 — 보낸 칸만 바뀐다 */
export type BoardPatch = {
  name?: string
  description?: string
  settings?: Partial<BoardSettings>
}

/**
 * 로그인하지 않고 쓰는 사람 — `name` 은 닉네임(만들기에만), `secret` 은 헤더 `X-Board-Guest-Secret` 로만 나간다(본문 · 주소에 두지 않는다),
 * `captchaToken` 은 `BoardConfig.captchaRequired` 일 때 만들기 본문에 실린다
 */
export type GuestCredentials = { name?: string; secret: string; captchaToken?: string }

/** 고치기 · 지우기 · 승인에서 비회원이 자기(글의) 비밀을 증명한다 — 로그인한 사람은 쓰지 않는다 */
export type GuestOptions = { guestSecret?: string }

/** 승인 대기 중인 고친 내용 — 공개본은 그대로다. 쓴 회원 · 운영자 · 관리하는 글 주인에게만 오고(남에게는 null), 비회원 작성자는 고친 응답에서만 본다 */
export type PendingRevision = {
  title?: string | null
  body: string
  attachments: string[]
  submittedAt: string
}

/** 서명 열람의 인자 - `from: 'edit'` 이면 대기 중인 고친 판의 첨부 목록, `as` 는 비회원이 증명할 비밀(`owner`: 글의 비밀, `author`: 댓글의 비밀) */
export type AttachmentAccessOptions = GuestOptions & {
  from?: 'current' | 'edit'
  as?: 'owner' | 'author'
}

/** 승인 전 · 판 사진을 관리하는 사람 · 작성자가 짧게 읽는 서명 주소 */
export type AttachmentAccess = { url: string; expiresInSeconds: number }

export type RevisionDecision = 'APPROVE' | 'REJECT'

export type Board = {
  code: string
  name: string
  description: string | null
  postCount: number
  /** 백엔드 `BoardResponse.createdAt`(계약 문서에는 없다) */
  createdAt?: string
  /** 게시판 설정 — 옛 서버는 없음(모두 꺼진 것으로 읽는다) */
  settings?: BoardSettings
}

export type BoardInput = { code: string; name: string; description?: string }

/** `PENDING` 은 승인을 기다리는 새 글 — 운영자 · 회원 작성자만 본다(비회원 작성자는 만들기 응답만) */
export type PostStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'DELETED'
/** `PENDING` 은 승인 대기 — 운영자 · 관리하는 글 주인 · 쓴 회원에게만 목록에 있다(남에게는 자리도 없다) */
export type CommentStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'DELETED'

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
  /** 비회원이 쓴 글이다 — `authorName` 은 그가 친 이름이다. 화면은 「(비회원)」 으로 회원 닉네임 사칭을 가른다. 옛 서버는 없음 */
  authorGuest?: boolean
  /** `?revision=pending` 목록(운영자)에서만 — 공개본(위 칸)과 나란히 비교한다 */
  pendingRevision?: PendingRevision | null
}

/** 글 한 건 — 목록 줄 + 본문 · 첨부(스토리지 키) */
export type PostDetail = PostSummary & {
  body: string
  attachments: string[]
  /** 공개 영역이 켜진 서버가 공개된 글에만 싣는다: 첨부 키 → 공개 주소(CDN) */
  attachmentUrls?: Record<string, string>
  /** 호출자가 이 글의 댓글을 승인 · 가릴 수 있다(운영자 · 댓글 관리가 켜진 게시판의 글 주인) — 승인 · 가리기 단추의 근거 */
  canManageComments?: boolean
  /** 글마다 정한 댓글 승인 규칙 — null 이면 게시판 값 */
  commentApproval?: ApprovalMode | null
}

export type PostInput = {
  title: string
  body: string
  attachments?: string[]
  /** 만들 때 기본 `PUBLISHED`. 고칠 때는 주인이 `DRAFT` ↔ `PUBLISHED` */
  status?: 'DRAFT' | 'PUBLISHED'
  /** 만들 때만 — `BoardConfig.authorRequired` 인 서버는 필수, 고칠 때는 보내지 않는다(작성자는 불변) */
  authorId?: string
  /** 만들 때 로그인하지 않은 사람 — 이름은 본문, 비밀은 헤더. 로그인한 사람이 보내면 서버가 400 */
  guest?: GuestCredentials
  /** 이 글의 댓글 승인 규칙 — 댓글 관리가 켜진 게시판에서만(아니면 400) */
  commentApproval?: ApprovalMode
}
export type PostPatch = Partial<Omit<PostInput, 'authorId' | 'guest'>>
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
  /** 운영자만 — 기본은 `PUBLISHED`. `PENDING` 은 승인 대기 글 */
  status?: PostStatus
  /** 운영자만 — `pending` 이면 고친 글 목록(공개본 + `pendingRevision`) */
  revision?: 'pending'
  /** true 면 내 글만(초안 포함) — 백엔드의 `mine`(계약 문서에는 없지만 컨트롤러가 받는다) */
  mine?: boolean
}
export type CommentListParams = { page?: number; size?: number; sort?: CommentSort }

/** 승인 대기 · 고친 댓글 목록 — 관리하는 쪽만(비회원 글 주인은 `guestSecret` 로 증명) */
export type CommentQueueParams = { page?: number; size?: number }

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
  /** 비회원이 쓴 댓글이다 — `authorName` 은 그가 친 이름 */
  authorGuest?: boolean
  /** 댓글 첨부(스토리지 키) — 보이는 댓글만, 가린 · 지운 댓글은 `[]`. 댓글 첨부가 꺼진 서버 · 옛 서버는 없음 */
  attachments?: string[]
  /** 대기 중인 고친 내용 — 쓴 회원 · 운영자 · 관리하는 글 주인에게만(남에게는 null) */
  pendingRevision?: PendingRevision | null
  /** 공개 영역이 켜진 서버가 공개된 댓글에만 싣는다: 첨부 키 → 공개 주소(CDN). 없으면 `renderAttachment` 가 서명 주소로 본다 */
  attachmentUrls?: Record<string, string>
  /** 댓글을 관리하는 사람에게만 실린다 — `false` 면 이 댓글의 상태를 지금 못 바꾼다(운영자가 가린 댓글을 글 주인이 되살릴 수 없다). 복원 단추의 근거 */
  canManage?: boolean
}

/** 계약의 `CommentThread` — 최상위 댓글 + 그 아래 **모든** 자손(평평하게, 오래된 순). 자손의 `replies` 는 항상 빈 배열 — 중첩은 `nestThread` 가 만든다 */
export type CommentWithReplies = Comment & { replies: Comment[] }

export type CommentInput = {
  body: string
  parentId?: BoardId
  /** 만들 때만 — `BoardConfig.authorRequired` 인 서버는 필수 */
  authorId?: string
  /** 첨부 저장 키 — `BoardConfig.commentMaxAttachments` 가 0 이면 보낼 수 없다 */
  attachments?: string[]
  /** 만들 때 로그인하지 않은 사람 */
  guest?: GuestCredentials
}

/** 댓글 고치기 — 본문 없이 첨부만 보내면 본문은 그대로 */
export type CommentPatch = { body?: string; attachments?: string[] }

/** 반응 대상 — 글 하나 또는 그 글의 댓글 하나 */
export type ReactionTarget =
  | { kind: 'post'; postId: BoardId }
  | { kind: 'comment'; postId: BoardId; commentId: BoardId }
