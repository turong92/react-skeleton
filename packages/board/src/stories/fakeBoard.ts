import { ErrorCodes } from '@skeleton/api-client'
import type { BoardApi } from '../boardApi'
import type { Board, Comment, CommentWithReplies, PostDetail, PostSummary } from '../types'
import { fail, pageOf, total, withDelay } from './fakeBoardSupport'
import { seedDemo } from './fakeBoardSeed'
import { createStore, type FakeBoardOptions } from './fakeBoardStore'

export type { FakeBoardOptions } from './fakeBoardStore'

/*
 * 스토리 · 시험용 메모리 안의 게시판 서버 — 백엔드 `modules/board` 의 계약(packages/board/README.md)을 따른다:
 * 고정 글 먼저 · 정렬 · 검색 · 쪽 · 소프트 삭제(댓글은 본문만 null) · 댓글 트리(깊이 · 최상위 단위 쪽) · SINGLE/PER_TYPE 반응 · 권한 오류.
 * 상태와 만들기 · 반응 세기는 `fakeBoardStore.ts`, 데모 데이터는 `fakeBoardSeed.ts`.
 */
export function createFakeBoard(options: FakeBoardOptions = {}) {
  const store = createStore(options)
  const {
    owns,
    authorOf,
    canModerate,
    config,
    comments,
    posts,
    seqOf,
    stamp,
    findPost,
    findComment,
    view,
    settings,
    revisions,
    secrets,
    canManage,
    needsApproval,
    newGuestAuthor,
    proves,
    need,
    sees,
  } = store
  const { guard, needModerator, react, newPost, newComment } = store
  const slow = withDelay(options.delayMs ?? 0)
  const page = <T>(all: T[], pageNo?: number, size?: number) => pageOf(all, stamp(), pageNo, size)
  /** 글 응답 — 대기 중인 고친 내용은 쓴 사람 · 운영자에게만 */
  const postView = (post: PostDetail): PostDetail => ({
    ...post,
    mine: owns(post.authorId),
    canManageComments: canManage(post),
    pendingRevision:
      revisions.get(post.id) && (canModerate || owns(post.authorId))
        ? revisions.get(post.id)!
        : null,
  })
  /** 목록 줄에는 `canManageComments` · `pendingRevision` 이 없다(고친 글 목록만 판을 싣는다) */
  const summaryView = (post: PostDetail, withRevision = false): PostSummary => {
    const row: Record<string, unknown> = { ...postView(post) }
    for (const key of ['body', 'attachments', 'canManageComments', 'commentApproval'])
      delete row[key]
    row.pendingRevision = withRevision ? (revisions.get(post.id) ?? null) : undefined
    return row as PostSummary
  }
  const setCommentStatus = (id: number, status: Comment['status']) => {
    const row = findComment(id)
    row.status = status
    if (status !== 'PUBLISHED') revisions.delete(id)
    return view(row)
  }
  const attachmentsOk = (keys: string[] | undefined) =>
    guard((keys?.length ?? 0) <= config.commentMaxAttachments!)
  /** 비회원 글 주인이거나 관리하는 쪽이어야 한다 — 아니면 403 (틀린 비밀 · 헤더 없음도 같다) */
  const managing = (postId: number, guestSecret?: string) => {
    need(canModerate || settings.ownerModeratesComments)
    const post = findPost(postId)
    need(
      canManage(post) ||
        (settings.ownerModeratesComments && proves(post.id, post.authorId, guestSecret)),
    )
    return post
  }

  const api: BoardApi = {
    getConfig: slow(async () => config),
    listBoards: slow(
      async (): Promise<Board[]> => [
        { code: 'free', name: 'Free board', description: null, postCount: posts.size, settings },
      ],
    ),
    getBoard: slow(async (code) => ({
      code,
      name: 'Free board',
      description: null,
      postCount: posts.size,
      settings,
    })),
    createBoard: slow(async (input) => ({
      ...input,
      description: input.description ?? null,
      postCount: 0,
    })),
    updateBoard: slow(async (code, patch) => {
      needModerator()
      return {
        code,
        name: patch.name ?? 'Free board',
        description: patch.description ?? null,
        postCount: posts.size,
        settings: { ...settings, ...patch.settings },
      }
    }),
    listPosts: slow(async (_code, params = {}) => {
      if (params.revision === 'pending') {
        needModerator()
        const rows = [...posts.values()].filter(
          (p) => revisions.has(p.id) && p.status === 'PUBLISHED',
        )
        return page(
          rows.map((r) => summaryView(r, true)),
          params.page,
          params.size,
        )
      }
      const status = canModerate ? (params.status ?? 'PUBLISHED') : 'PUBLISHED'
      const q = params.q?.toLowerCase() ?? ''
      const key = (p: PostDetail) => {
        if (params.sort === 'comments') return p.commentCount
        if (params.sort === 'reactions')
          return params.reaction
            ? (p.reactionCounts[params.reaction] ?? 0)
            : total(p.reactionCounts)
        return seqOf(p.id)
      }
      const rows = [...posts.values()]
        .filter((p) => (params.mine ? owns(p.authorId) : p.status === status))
        .filter((p) => !q || `${p.title} ${p.body}`.toLowerCase().includes(q))
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) || key(b) - key(a) || seqOf(b.id) - seqOf(a.id),
        )
      return page(
        rows.map((r) => summaryView(r)),
        params.page,
        params.size,
      )
    }),
    getPost: slow(async (_code, id) => {
      const row = findPost(id)
      const visible = row.status === 'PUBLISHED' || owns(row.authorId) || canModerate
      if (!visible) fail(ErrorCodes.BOARD_POST_NOT_FOUND, 404, 'Post not found')
      row.viewCount += 1
      return postView(row)
    }),
    createPost: slow(async (_code, input) => {
      guard(input.title.trim() !== '' && input.title.length <= config.titleMaxLength)
      guard(input.body.trim() !== '' && input.body.length <= config.bodyMaxLength)
      const guest = input.guest
      const author = guest
        ? newGuestAuthor(guest, settings.guestWrite === 'ALL')
        : options.anonymous
          ? fail('COMMON.UNAUTHORIZED', 401, 'Unauthorized')
          : authorOf(input.authorId)
      const status =
        (input.status ?? 'PUBLISHED') === 'PUBLISHED' && needsApproval('post', guest !== undefined)
          ? 'PENDING'
          : (input.status ?? 'PUBLISHED')
      const row = newPost(input.title.trim(), input.body, author, { status })
      if (guest) secrets.set(row.id, guest.secret)
      return postView(row)
    }),
    updatePost: slow(async (_code, id, patch, guestOptions) => {
      const row = findPost(id)
      need(canModerate || owns(row.authorId) || proves(id, row.authorId, guestOptions?.guestSecret))
      if (patch.title !== undefined)
        guard(patch.title.trim() !== '' && patch.title.length <= config.titleMaxLength)
      if (patch.body !== undefined)
        guard(patch.body.trim() !== '' && patch.body.length <= config.bodyMaxLength)
      const content =
        patch.title !== undefined || patch.body !== undefined || patch.attachments !== undefined
      const guestWriter = row.authorId.startsWith('guest:')
      // 승인 대상 작성자가 공개된 글을 고치면 공개본은 그대로 두고 고친 내용만 대기한다
      if (content && row.status === 'PUBLISHED' && needsApproval('post', guestWriter)) {
        const previous = revisions.get(id)
        revisions.set(id, {
          title: patch.title?.trim() ?? previous?.title ?? row.title,
          body: patch.body ?? previous?.body ?? row.body,
          attachments: patch.attachments ?? previous?.attachments ?? row.attachments,
          submittedAt: stamp(),
        })
        // 비회원은 다시 읽을 때 판을 보지 못한다 — 이 응답으로만 본다
        return { ...postView(row), pendingRevision: revisions.get(id)! }
      }
      if (content) revisions.delete(id)
      const { status, ...rest } = patch
      Object.assign(row, {
        ...rest,
        excerpt: (patch.body ?? row.body).slice(0, 80),
        updatedAt: stamp(),
      })
      if (status !== undefined && !(row.status === 'PENDING' && status === 'PUBLISHED'))
        row.status = status
      return postView(row)
    }),
    removePost: slow(async (_code, id, guestOptions) => {
      const row = findPost(id)
      need(canModerate || owns(row.authorId) || proves(id, row.authorId, guestOptions?.guestSecret))
      row.status = 'DELETED'
      revisions.delete(id)
    }),
    moderatePost: slow(async (_code, id, moderation) => {
      needModerator()
      const row = findPost(id)
      if (moderation.pinned !== undefined) row.pinned = moderation.pinned
      row.status = moderation.status ?? row.status
      if (row.status !== 'PUBLISHED') revisions.delete(id)
      return postView(row)
    }),
    decidePostRevision: slow(async (_code, id, decision, submittedAt) => {
      needModerator()
      const row = findPost(id)
      const revision =
        revisions.get(id) ?? fail(ErrorCodes.BOARD_POST_NOT_FOUND, 404, 'No pending revision')
      if (revision.submittedAt !== submittedAt)
        fail(ErrorCodes.BOARD_REVISION_CHANGED, 409, 'The edit changed')
      if (decision === 'APPROVE')
        Object.assign(row, {
          title: revision.title ?? row.title,
          body: revision.body,
          excerpt: revision.body.slice(0, 80),
          attachments: revision.attachments,
          attachmentCount: revision.attachments.length,
          updatedAt: stamp(),
        })
      revisions.delete(id)
      return postView(row)
    }),
    listComments: slow(async (_code, postId, params = {}) => {
      const post = findPost(postId)
      const all = [...comments.values()].filter((c) => c.postId === postId && sees(c, post))
      const key = (c: Comment) =>
        params.sort === 'reactions' ? total(c.reactionCounts) : seqOf(c.id)
      const roots = all
        .filter((c) => c.parentId === null)
        .sort((a, b) =>
          params.sort === 'oldest' || params.sort === undefined ? key(a) - key(b) : key(b) - key(a),
        )
      const threads: CommentWithReplies[] = roots.map((root) => ({
        ...view(root, post),
        replies: all
          .filter((c) => c.rootId === root.id && c.id !== root.id)
          .sort((a, b) => seqOf(a.id) - seqOf(b.id))
          .map((c) => view(c, post)),
      }))
      return page(threads, params.page, params.size)
    }),
    listPendingComments: slow(async (_code, postId, params = {}, guestOptions) => {
      const post = managing(postId, guestOptions?.guestSecret)
      const rows = [...comments.values()].filter(
        (c) => c.postId === postId && c.status === 'PENDING',
      )
      return page(
        rows.sort((a, b) => seqOf(a.id) - seqOf(b.id)).map((c) => view(c, post)),
        params.page,
        params.size,
      )
    }),
    listCommentRevisions: slow(async (_code, postId, params = {}, guestOptions) => {
      const post = managing(postId, guestOptions?.guestSecret)
      const rows = [...comments.values()].filter((c) => c.postId === postId && revisions.has(c.id))
      return page(
        rows.sort((a, b) => seqOf(a.id) - seqOf(b.id)).map((c) => view(c, post)),
        params.page,
        params.size,
      )
    }),
    createComment: slow(async (_code, postId, input) => {
      const post = findPost(postId)
      if (post.status !== 'PUBLISHED')
        fail(ErrorCodes.BOARD_POST_NOT_COMMENTABLE, 409, 'Not commentable')
      guard(input.body.trim() !== '' && input.body.length <= config.commentMaxLength)
      attachmentsOk(input.attachments)
      const guest = input.guest
      const author = guest
        ? newGuestAuthor(guest, settings.guestWrite !== 'NONE')
        : options.anonymous
          ? fail('COMMON.UNAUTHORIZED', 401, 'Unauthorized')
          : authorOf(input.authorId)
      const status = needsApproval('comment', guest !== undefined, post) ? 'PENDING' : 'PUBLISHED'
      const row = newComment(postId, input.body.trim(), input.parentId ?? null, author, {
        status,
        attachments: input.attachments ?? [],
      })
      if (guest) secrets.set(row.id, guest.secret)
      return view(row, post)
    }),
    updateComment: slow(async (_code, postId, id, input, guestOptions) => {
      const post = findPost(postId)
      const row = findComment(id)
      need(owns(row.authorId) || proves(id, row.authorId, guestOptions?.guestSecret))
      if (input.body !== undefined)
        guard(input.body.trim() !== '' && input.body.length <= config.commentMaxLength)
      attachmentsOk(input.attachments)
      if (
        row.status === 'PUBLISHED' &&
        needsApproval('comment', row.authorId.startsWith('guest:'), post)
      ) {
        const previous = revisions.get(id)
        revisions.set(id, {
          body: input.body?.trim() ?? previous?.body ?? row.body ?? '',
          attachments: input.attachments ?? previous?.attachments ?? row.attachments ?? [],
          submittedAt: stamp(),
        })
        return { ...view(row, post), pendingRevision: revisions.get(id)! }
      }
      revisions.delete(id)
      Object.assign(row, {
        ...(input.body === undefined ? {} : { body: input.body.trim() }),
        ...(input.attachments === undefined ? {} : { attachments: input.attachments }),
        updatedAt: stamp(),
      })
      return view(row, post)
    }),
    removeComment: slow(async (_code, _postId, id, guestOptions) => {
      const row = findComment(id)
      need(canModerate || owns(row.authorId) || proves(id, row.authorId, guestOptions?.guestSecret))
      row.status = 'DELETED'
      revisions.delete(id)
    }),
    moderateComment: slow(async (_code, postId, id, moderation, guestOptions) => {
      const post = managing(postId, guestOptions?.guestSecret)
      const row = findComment(id)
      if (!canModerate) need(moderation.status === 'PUBLISHED' || moderation.status === 'HIDDEN')
      const was = row.status
      const result = setCommentStatus(id, moderation.status)
      if (was === 'PENDING' && moderation.status === 'PUBLISHED') post.commentCount += 1
      if (was === 'PUBLISHED' && moderation.status !== 'PUBLISHED') post.commentCount -= 1
      return result
    }),
    decideCommentRevision: slow(async (_code, postId, id, decision, submittedAt, guestOptions) => {
      const post = managing(postId, guestOptions?.guestSecret)
      const row = findComment(id)
      const revision =
        revisions.get(id) ?? fail(ErrorCodes.BOARD_COMMENT_NOT_FOUND, 404, 'No pending revision')
      if (revision.submittedAt !== submittedAt)
        fail(ErrorCodes.BOARD_REVISION_CHANGED, 409, 'The edit changed')
      if (decision === 'APPROVE')
        Object.assign(row, {
          body: revision.body,
          attachments: revision.attachments,
          updatedAt: stamp(),
        })
      revisions.delete(id)
      return view(row, post)
    }),
    putReaction: slow(async (_code, target, type) => react(target, type, true)),
    removeReaction: slow(async (_code, target, type) => react(target, type, false)),
  }

  const board = {
    api,
    config,
    controls: store.controls,
    newPost: store.newPost,
    newComment: store.newComment,
  }
  if (options.seed ?? true) seedDemo(store)
  return board
}
