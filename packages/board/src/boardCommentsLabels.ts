import { defaultCommentLabels, type CommentLabels } from './commentLabels'
import type { CommentSort } from './types'

/** `BoardComments` 의 글자 — 댓글 영역 글자(`CommentLabels`)에 더해 목록 · 삭제 확인 글자. 기본은 영어 */
export type BoardCommentsLabels = CommentLabels & {
  heading: string
  sort: string
  sorts: Record<CommentSort, string>
  empty: string
  loading: string
  loadError: string
  retry: string
  confirmDeleteTitle: string
  confirmDeleteBody: string
  confirmDelete: string
  close: string
  pagination: { label: string; previous: string; next: string; page: (n: number) => string }
}

export type BoardCommentsLabelsInput = Partial<
  Omit<BoardCommentsLabels, 'sorts' | 'pagination'>
> & {
  sorts?: Partial<BoardCommentsLabels['sorts']>
  pagination?: Partial<BoardCommentsLabels['pagination']>
}

const defaults: BoardCommentsLabels = {
  ...defaultCommentLabels,
  heading: 'Comments',
  sort: 'Sort comments',
  sorts: { oldest: 'Oldest', latest: 'Latest', reactions: 'Most reactions' },
  empty: 'No comments yet.',
  loading: 'Loading',
  loadError: 'Could not load comments.',
  retry: 'Try again',
  confirmDeleteTitle: 'Delete this comment?',
  confirmDeleteBody: 'The comment is replaced by a placeholder. Replies stay.',
  confirmDelete: 'Delete',
  close: 'Close',
  pagination: {
    label: 'Comment pages',
    previous: 'Previous page',
    next: 'Next page',
    page: (n) => `Page ${n}`,
  },
}

export function resolveBoardCommentsLabels(
  input: BoardCommentsLabelsInput = {},
): BoardCommentsLabels {
  const { sorts, pagination, ...flat } = input
  return {
    ...defaults,
    ...flat,
    sorts: { ...defaults.sorts, ...sorts },
    pagination: { ...defaults.pagination, ...pagination },
  }
}
