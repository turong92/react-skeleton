import type { ApiPageResponse } from '@skeleton/api-client'
import type { BoardApi } from '../boardApi'
import type { Comment, CommentWithReplies, PostDetail, PostSummary } from '../types'

/*
 * 테스트 · 스토리가 함께 쓰는 만들기 도우미(공개 표면 아님 — index.ts 가 내보내지 않는다). 가짜 서버는 stories/fakeBoard.ts(스토리집을 뗀 프로젝트에도 남도록 stories/ 밖에 둔다).
 */
export const at = '2026-01-01T00:00:00Z'

export const summary = (id: number, over: Partial<PostSummary> = {}): PostSummary => ({
  id,
  boardCode: 'free',
  authorId: 'u1',
  title: `Post ${id}`,
  excerpt: 'excerpt',
  status: 'PUBLISHED',
  pinned: false,
  viewCount: 0,
  commentCount: 0,
  reactionCounts: {},
  myReactions: [],
  attachmentCount: 0,
  createdAt: at,
  updatedAt: at,
  ...over,
})

export const detail = (id: number, over: Partial<PostDetail> = {}): PostDetail => ({
  ...summary(id),
  body: `Body of ${id}`,
  attachments: [],
  ...over,
})

export const comment = (
  id: number,
  parentId: number | null = null,
  over: Partial<Comment> = {},
): Comment => ({
  id,
  postId: 1,
  parentId,
  rootId: parentId === null ? id : 1,
  depth: parentId === null ? 0 : 1,
  authorId: 'u1',
  body: `Comment ${id}`,
  status: 'PUBLISHED',
  reactionCounts: {},
  myReactions: [],
  replyCount: 0,
  createdAt: at,
  updatedAt: at,
  ...over,
})

export const thread = (id: number, replies: Comment[] = [], over: Partial<Comment> = {}) => ({
  ...comment(id, null, over),
  replies,
})

export const page = <T>(values: T[]): ApiPageResponse<T> => ({
  values,
  pagination: {
    page: 0,
    size: 20,
    totalElements: values.length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  },
  meta: { timestamp: at },
})

export const threads = (...values: CommentWithReplies[]) => page(values)

/** 어느 호출도 하지 않는 api — 시험이 필요한 메서드만 덮어쓴다 */
export function stubApi(over: Partial<BoardApi> = {}): BoardApi {
  const unused = async (): Promise<never> => {
    throw new Error('unused in this test')
  }
  return {
    getConfig: unused,
    listBoards: unused,
    getBoard: unused,
    createBoard: unused,
    listPosts: unused,
    getPost: unused,
    createPost: unused,
    updatePost: unused,
    removePost: unused,
    moderatePost: unused,
    listComments: unused,
    createComment: unused,
    updateComment: unused,
    removeComment: unused,
    moderateComment: unused,
    putReaction: unused,
    removeReaction: unused,
    ...over,
  }
}

/** 손으로 풀어 주는 약속 — 요청이 날아가는 동안의 화면을 잰다 */
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
