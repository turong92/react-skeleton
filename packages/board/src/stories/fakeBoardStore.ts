import { ErrorCodes } from '@skeleton/api-client'
import type {
  BoardConfig,
  Comment,
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
  /** 계정 id → 꼬리표(4자리, 꼬리표 방식 서버). 없으면 null */
  tags?: Record<string, string>
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
  /** 서버가 글 · 댓글 응답에 붙이는 작성자 필드 */
  const authorFields = (id: string) => ({
    authorId: id,
    authorName: id.startsWith('deleted:') ? null : (nicknames[id] ?? null),
    authorDeleted: id.startsWith('deleted:'),
    authorTag: options.tags?.[id] ?? null,
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
  }
  const posts = new Map<number, PostDetail>()
  const comments = new Map<number, Comment>()
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

  function newComment(postId: number, body: string, parentId: number | null, author = me) {
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
    }
    comments.set(row.id, row)
    order.set(row.id, seq)
    findPost(postId).commentCount += 1
    return row
  }

  /** 응답 모양의 댓글 — 본문은 `PUBLISHED` 가 아니면 null, `replyCount` 는 모든 자손 */
  const view = (row: Comment): Comment => {
    const descendants = (id: number): number =>
      [...comments.values()]
        .filter((c) => c.parentId === id)
        .reduce((sum, c) => sum + 1 + descendants(c.id), 0)
    return {
      ...row,
      body: row.status === 'PUBLISHED' ? row.body : null,
      replyCount: descendants(row.id),
    }
  }

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

  return {
    me,
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
  }
}
export type FakeStore = ReturnType<typeof createStore>
