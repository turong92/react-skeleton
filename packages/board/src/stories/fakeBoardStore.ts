import { ErrorCodes } from '@skeleton/api-client'
import type {
  ApprovalMode,
  BoardConfig,
  Comment,
  GuestSecretKind,
  GuestWrite,
  PendingRevision,
  PostDetail,
  ReactionMode,
  ReactionState,
  ReactionTarget,
} from '../types'
import { fail } from './fakeBoardSupport'

export type FakeBoardOptions = {
  /** 데모 글 · 댓글로 시작(기본 true) */
  seed?: boolean
  mode?: ReactionMode
  types?: string[]
  /** 호출자(내 계정 id) */
  me?: string
  canModerate?: boolean
  /** 호출마다 기다리는 시간(ms) — 로딩 · 진행 중 상태를 스토리에서 본다 */
  delayMs?: number
  maxCommentDepth?: number
  /** true 면 반응 요청을 서버 오류로 거절한다(낙관적 갱신의 되돌리기를 본다) */
  failReactions?: boolean
  /**
   * 계정 id → 닉네임(null = 닉네임 없는 계정). 목록에 없는 id 도 닉네임 없음으로 읽는다.
   * `deleted:` 로 시작하는 id 는 탈퇴한 작성자(`authorDeleted: true`). 기본은 데모 시드의 작성자들.
   */
  nicknames?: Record<string, string | null>
  /**
   * true 면 작성자 프로필을 쓰는 서버처럼 군다 — `config.authorRequired`, 쓰기에 `authorId` 필수(없으면 400 `BOARD.AUTHOR_REQUIRED`,
   * 내 것이 아니면 403 `BOARD.AUTHOR_NOT_ALLOWED`), 글 · 댓글의 `authorId` 는 그 id. 꺼져 있을 때 `authorId` 를 보내도 403 `BOARD.AUTHOR_NOT_ALLOWED`
   */
  authorRequired?: boolean
  /** 호출자(`me`)가 쓸 수 있는 작성자 id들(프로필) — 이 id 의 글 · 댓글도 `mine: true`, 수정 · 삭제도 된다 */
  owned?: string[]
  /** 계정 id → 꼬리표(4자리, 꼬리표 방식 서버). 없으면 null */
  tags?: Record<string, string>
  /** true 면 로그인하지 않은 호출자 — 쓰기는 `guest` 로만, `mine` 은 늘 false(서버는 비회원을 모른다) */
  anonymous?: boolean
  /** 게시판 설정 — 기본은 모두 꺼짐(NONE · OFF). `guestWrite` 가 NONE 이면 `guest.enabled` 여도 익명 쓰기는 401 */
  guestWrite?: GuestWrite
  postApproval?: ApprovalMode
  commentApproval?: ApprovalMode
  ownerModerates?: boolean
  /** `config.guestEnabled` (기본: `guestWrite` 가 NONE 이 아니면 true) */
  guestEnabled?: boolean
  guestSecret?: GuestSecretKind
  captchaRequired?: boolean
  /** 댓글 첨부 상한(0 = 꺼짐) */
  commentMaxAttachments?: number
}

const DEFAULT_NICKNAMES: Record<string, string | null> = {
  me: 'Me',
  admin: 'Admin',
  alice: 'Alice',
  bob: 'Bob',
  carol: 'Carol',
  dave: 'Dave',
}

/** 가짜 서버의 상태 — 글 · 댓글(만든 순서는 행 밖의 `order` 에 둬서 응답 모양이 계약 그대로다) · 만들기 · 보이기 · 반응 세기 */
export function createStore(options: FakeBoardOptions) {
  const { mode = 'SINGLE', me = 'me', canModerate = false } = options
  const nicknames = options.nicknames ?? DEFAULT_NICKNAMES
  const guestWrite = options.guestWrite ?? 'NONE'
  const settings = {
    guestWrite,
    postApproval: options.postApproval ?? 'OFF',
    commentApproval: options.commentApproval ?? 'OFF',
    ownerModeratesComments: options.ownerModerates ?? false,
  } as const
  /** 비회원 행의 이름 · 비밀 — 비밀은 응답에 나가지 않는다 */
  const guestNames = new Map<string, string>()
  const secrets = new Map<number, string>()
  const ownedIds = new Set(options.anonymous ? [] : [me, ...(options.owned ?? [])])
  /** 서버가 `mine` 을 싣는 규칙 — 호출자가 쓸 수 있는 작성자 id 인가 */
  const owns = (authorId: string) => ownedIds.has(authorId)
  /** 서버가 글 · 댓글 응답에 붙이는 작성자 필드 */
  const authorFields = (id: string) => ({
    authorId: id,
    authorName: id.startsWith('deleted:') ? null : (guestNames.get(id) ?? nicknames[id] ?? null),
    authorDeleted: id.startsWith('deleted:'),
    authorTag: options.tags?.[id] ?? null,
    authorGuest: id.startsWith('guest:'),
  })
  const types = options.types ?? ['LIKE', 'DISLIKE']
  const config: BoardConfig = {
    reactionTypes: types,
    reactionMode: mode,
    maxCommentDepth: options.maxCommentDepth ?? 2,
    titleMaxLength: 80,
    bodyMaxLength: 2000,
    commentMaxLength: 300,
    maxPageSize: 50,
    canModerate,
    ...(options.authorRequired === undefined ? {} : { authorRequired: options.authorRequired }),
    guestEnabled: options.guestEnabled ?? guestWrite !== 'NONE',
    guestSecret: options.guestSecret ?? 'PASSWORD',
    guestNameMaxLength: 20,
    captchaRequired: options.captchaRequired ?? false,
    commentMaxAttachments: options.commentMaxAttachments ?? 0,
  }
  const posts = new Map<number, PostDetail>()
  const comments = new Map<number, Comment>()
  /** 대기 중인 고친 내용 — 행마다 하나. 응답에는 보는 사람에게 허락될 때만 실린다 */
  const revisions = new Map<number, PendingRevision>()
  const controls = { failReactions: options.failReactions ?? false }
  const order = new Map<number, number>()
  let seq = 0
  const seqOf = (id: number) => order.get(id) ?? 0
  const stamp = () => new Date(Date.UTC(2026, 0, 1, 12, 0) + seq * 60_000).toISOString()
  const zero = () => Object.fromEntries(types.map((type) => [type, 0]))

  const findPost = (id: number) =>
    posts.get(id) ?? fail(ErrorCodes.BOARD_POST_NOT_FOUND, 404, 'Post not found')
  const findComment = (id: number) =>
    comments.get(id) ?? fail(ErrorCodes.BOARD_COMMENT_NOT_FOUND, 404, 'Comment not found')

  function newPost(title: string, body: string, author = me, over: Partial<PostDetail> = {}) {
    seq += 1
    const row: PostDetail = {
      id: seq,
      boardCode: 'free',
      ...authorFields(author),
      title,
      excerpt: body.slice(0, 80),
      body,
      status: 'PUBLISHED',
      pinned: false,
      viewCount: 0,
      commentCount: 0,
      reactionCounts: zero(),
      myReactions: [],
      attachmentCount: 0,
      attachments: [],
      createdAt: stamp(),
      updatedAt: stamp(),
      ...over,
    }
    posts.set(row.id, row)
    order.set(row.id, seq)
    return row
  }

  function newComment(
    postId: number,
    body: string,
    parentId: number | null,
    author = me,
    over: Partial<Comment> = {},
  ) {
    const parent = parentId === null ? null : findComment(parentId)
    const depth = parent ? parent.depth + 1 : 0
    if (depth > config.maxCommentDepth) fail(ErrorCodes.BOARD_COMMENT_TOO_DEEP, 422, 'Too deep')
    seq += 1
    const row: Comment = {
      id: seq,
      postId,
      parentId,
      rootId: parent ? parent.rootId : seq,
      depth,
      ...authorFields(author),
      body,
      status: 'PUBLISHED',
      reactionCounts: zero(),
      myReactions: [],
      replyCount: 0,
      createdAt: stamp(),
      updatedAt: stamp(),
      attachments: [],
      ...over,
    }
    comments.set(row.id, row)
    order.set(row.id, seq)
    if (row.status === 'PUBLISHED') findPost(postId).commentCount += 1
    return row
  }

  /** 이 글의 댓글을 승인 · 가릴 수 있는 호출자 — 운영자, 댓글 관리가 켜진 게시판의 글 주인 */
  const canManage = (post: PostDetail) =>
    canModerate || (settings.ownerModeratesComments && owns(post.authorId))
  /** 서버의 `needsApproval` — 운영자는 면제, 댓글을 관리하는 글 주인은 자기 글의 댓글에 대해 면제 */
  const needsApproval = (target: 'post' | 'comment', guest: boolean, post?: PostDetail) => {
    if (canModerate) return false
    const mode = target === 'post' ? settings.postApproval : settings.commentApproval
    if (mode === 'OFF') return false
    if (mode === 'GUESTS') return guest
    return !(target === 'comment' && post && canManage(post))
  }
  /** 비회원 만들기 규칙(서버와 같은 순서·코드) — 이름 · 비밀 · 캡차 검사 뒤 새 행 id 의 작성자 값을 돌려준다 */
  const newGuestAuthor = (
    guest: { name?: string; secret: string; captchaToken?: string },
    allowed: boolean,
  ) => {
    if (!options.anonymous)
      fail(ErrorCodes.BOARD_CONTENT_INVALID, 400, 'Guest name is for signed-out writers')
    if (!allowed || !config.guestEnabled) fail('COMMON.UNAUTHORIZED', 401, 'Unauthorized')
    if (!guest.name?.trim() || guest.name.trim().length > 20)
      fail(ErrorCodes.BOARD_CONTENT_INVALID, 400, 'Invalid guest name')
    if (guest.secret.length < 4) fail(ErrorCodes.BOARD_CONTENT_INVALID, 400, 'Invalid guest secret')
    if (config.captchaRequired && !guest.captchaToken)
      fail(ErrorCodes.BOARD_CAPTCHA_FAILED, 400, 'Captcha failed')
    const id = `guest:${seq + 1}`
    guestNames.set(id, guest.name!.trim())
    return id
  }
  /** 비회원 행의 비밀 확인 — 틀린 비밀 · 회원 행 · 헤더 없음은 모두 같은 403 */
  const proves = (id: number, authorId: string, secret?: string) =>
    authorId.startsWith('guest:') && secret !== undefined && secrets.get(id) === secret
  const need = (ok: boolean) => ok || fail(ErrorCodes.BOARD_FORBIDDEN, 403, 'Forbidden')

  /** 응답 모양의 댓글 — 본문은 `PUBLISHED`(와 보는 사람에게 남은 `PENDING`)가 아니면 null, `replyCount` 는 보이는 자손 */
  const view = (row: Comment, post: PostDetail = findPost(row.postId)): Comment => {
    const descendants = (id: number): number =>
      [...comments.values()]
        .filter((c) => c.parentId === id && sees(c, post))
        .reduce((sum, c) => sum + 1 + descendants(c.id), 0)
    const shown = row.status === 'PUBLISHED' || row.status === 'PENDING'
    const revision = revisions.get(row.id)
    return {
      ...row,
      mine: owns(row.authorId),
      body: shown ? row.body : null,
      attachments: shown ? (row.attachments ?? []) : [],
      pendingRevision: revision && (canManage(post) || owns(row.authorId)) ? revision : null,
      replyCount: descendants(row.id),
    }
  }
  /** 승인 대기 댓글은 관리하는 쪽 · 쓴 회원에게만 자리가 있다 */
  const sees = (row: Comment, post: PostDetail) =>
    row.status !== 'PENDING' || canManage(post) || owns(row.authorId)

  /** 서버가 반응을 세는 규칙 — `reactions.ts` 와 일부러 따로 썼다(같은 코드면 서로를 검증하지 못한다) */
  function react(target: ReactionTarget, type: string | undefined, add: boolean): ReactionState {
    if (controls.failReactions) fail('COMMON.INTERNAL_SERVER_ERROR', 500, 'Reaction failed')
    if (type !== undefined && !types.includes(type))
      fail(ErrorCodes.BOARD_REACTION_TYPE_INVALID, 400, 'Unknown reaction type')
    const row = target.kind === 'post' ? findPost(target.postId) : findComment(target.commentId)
    const mine = row.myReactions
    const drop = (t: string) => {
      row.reactionCounts[t] = Math.max(0, (row.reactionCounts[t] ?? 0) - 1)
      mine.splice(mine.indexOf(t), 1)
    }
    if (add && type !== undefined && !mine.includes(type)) {
      if (mode === 'SINGLE') [...mine].forEach(drop)
      row.reactionCounts[type] = (row.reactionCounts[type] ?? 0) + 1
      mine.push(type)
    }
    if (!add) [...mine].filter((t) => type === undefined || t === type).forEach(drop)
    return { counts: { ...row.reactionCounts }, myReactions: [...mine] }
  }

  /** 쓰기 요청의 작성자 — 프로필을 쓰는 서버는 `authorId` 필수 · 내 것만, 아니면 계정 자신(`authorId` 를 보내면 403) */
  const authorOf = (authorId: string | undefined) => {
    if (!config.authorRequired) {
      // 서버는 필수가 아닐 때 보낸 authorId 를 거절한다(스펙 §7.1) — 선택기가 없는 화면은 키 자체를 보내지 않는다
      if (authorId !== undefined)
        fail(ErrorCodes.BOARD_AUTHOR_NOT_ALLOWED, 403, 'Author not allowed')
      return me
    }
    if (!authorId) fail(ErrorCodes.BOARD_AUTHOR_REQUIRED, 400, 'Author required')
    if (!owns(authorId!)) fail(ErrorCodes.BOARD_AUTHOR_NOT_ALLOWED, 403, 'Author not allowed')
    return authorId!
  }

  return {
    me,
    owns,
    authorOf,
    mode,
    canModerate,
    config,
    controls,
    posts,
    comments,
    seqOf,
    stamp,
    findPost,
    findComment,
    newPost,
    newComment,
    view,
    react,
    guard: (valid: boolean) =>
      valid || fail(ErrorCodes.BOARD_CONTENT_INVALID, 400, 'Invalid content'),
    needModerator: () => canModerate || fail(ErrorCodes.BOARD_FORBIDDEN, 403, 'Forbidden'),
    settings,
    revisions,
    secrets,
    canManage,
    needsApproval,
    newGuestAuthor,
    proves,
    need,
    sees,
  }
}
export type FakeStore = ReturnType<typeof createStore>
