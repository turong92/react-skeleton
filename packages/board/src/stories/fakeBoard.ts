import { ErrorCodes } from '@skeleton/api-client'
import type { BoardApi } from '../boardApi'
import type { Board, Comment, CommentWithReplies, PostDetail } from '../types'
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
  const { me, canModerate, config, comments, posts, seqOf, stamp, findPost, findComment, view } =
    store
  const { guard, needModerator, react, newPost, newComment } = store
  const slow = withDelay(options.delayMs ?? 0)
  const page = <T>(all: T[], pageNo?: number, size?: number) => pageOf(all, stamp(), pageNo, size)
  const postView = (post: PostDetail): PostDetail => ({ ...post })
  const setCommentStatus = (id: number, status: Comment['status']) => {
    const row = findComment(id)
    row.status = status
    return view(row)
  }

  const api: BoardApi = {
    getConfig: slow(async () => config),
    listBoards: slow(
      async (): Promise<Board[]> => [
        { code: 'free', name: 'Free board', description: null, postCount: posts.size },
      ],
    ),
    getBoard: slow(async (code) => ({
      code,
      name: 'Free board',
      description: null,
      postCount: posts.size,
    })),
    createBoard: slow(async (input) => ({
      ...input,
      description: input.description ?? null,
      postCount: 0,
    })),
    listPosts: slow(async (_code, params = {}) => {
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
        .filter((p) => p.status === status)
        .filter((p) => !q || `${p.title} ${p.body}`.toLowerCase().includes(q))
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) || key(b) - key(a) || seqOf(b.id) - seqOf(a.id),
        )
      return page(
        rows.map((r) => postView(r)),
        params.page,
        params.size,
      )
    }),
    getPost: slow(async (_code, id) => {
      const row = findPost(id)
      const visible = row.status === 'PUBLISHED' || row.authorId === me || canModerate
      if (!visible) fail(ErrorCodes.BOARD_POST_NOT_FOUND, 404, 'Post not found')
      row.viewCount += 1
      return postView(row)
    }),
    createPost: slow(async (_code, input) => {
      guard(input.title.trim() !== '' && input.title.length <= config.titleMaxLength)
      guard(input.body.trim() !== '' && input.body.length <= config.bodyMaxLength)
      return postView(
        newPost(input.title.trim(), input.body, me, { status: input.status ?? 'PUBLISHED' }),
      )
    }),
    updatePost: slow(async (_code, id, patch) => {
      const row = findPost(id)
      if (row.authorId !== me && !canModerate) fail(ErrorCodes.BOARD_FORBIDDEN, 403, 'Forbidden')
      if (patch.title !== undefined)
        guard(patch.title.trim() !== '' && patch.title.length <= config.titleMaxLength)
      if (patch.body !== undefined)
        guard(patch.body.trim() !== '' && patch.body.length <= config.bodyMaxLength)
      Object.assign(row, {
        ...patch,
        excerpt: (patch.body ?? row.body).slice(0, 80),
        updatedAt: stamp(),
      })
      return postView(row)
    }),
    removePost: slow(async (_code, id) => {
      const row = findPost(id)
      if (row.authorId !== me && !canModerate) fail(ErrorCodes.BOARD_FORBIDDEN, 403, 'Forbidden')
      row.status = 'DELETED'
    }),
    moderatePost: slow(async (_code, id, moderation) => {
      needModerator()
      const row = findPost(id)
      if (moderation.pinned !== undefined) row.pinned = moderation.pinned
      row.status = moderation.status ?? row.status
      return postView(row)
    }),
    listComments: slow(async (_code, postId, params = {}) => {
      const all = [...comments.values()].filter((c) => c.postId === postId)
      const key = (c: Comment) =>
        params.sort === 'reactions' ? total(c.reactionCounts) : seqOf(c.id)
      const roots = all
        .filter((c) => c.parentId === null)
        .sort((a, b) =>
          params.sort === 'oldest' || params.sort === undefined ? key(a) - key(b) : key(b) - key(a),
        )
      const threads: CommentWithReplies[] = roots.map((root) => ({
        ...view(root),
        replies: all
          .filter((c) => c.rootId === root.id && c.id !== root.id)
          .sort((a, b) => seqOf(a.id) - seqOf(b.id))
          .map(view),
      }))
      return page(threads, params.page, params.size)
    }),
    createComment: slow(async (_code, postId, input) => {
      const post = findPost(postId)
      if (post.status !== 'PUBLISHED')
        fail(ErrorCodes.BOARD_POST_NOT_COMMENTABLE, 409, 'Not commentable')
      guard(input.body.trim() !== '' && input.body.length <= config.commentMaxLength)
      return view(newComment(postId, input.body.trim(), input.parentId ?? null))
    }),
    updateComment: slow(async (_code, _postId, id, input) => {
      const row = findComment(id)
      if (row.authorId !== me) fail(ErrorCodes.BOARD_FORBIDDEN, 403, 'Forbidden')
      guard(input.body.trim() !== '' && input.body.length <= config.commentMaxLength)
      Object.assign(row, { body: input.body.trim(), updatedAt: stamp() })
      return view(row)
    }),
    removeComment: slow(async (_code, _postId, id) => {
      const row = findComment(id)
      if (row.authorId !== me && !canModerate) fail(ErrorCodes.BOARD_FORBIDDEN, 403, 'Forbidden')
      row.status = 'DELETED'
    }),
    moderateComment: slow(async (_code, _postId, id, moderation) => {
      needModerator()
      return setCommentStatus(id, moderation.status)
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
