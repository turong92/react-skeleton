import type { PostSort, PostStatus } from './types'

/** 글 목록의 글자 전부 — 기본은 영어. 일부만 덮어쓰려면 `labels={{ caption: '글 목록' }}`(`sorts` · `pagination` 은 안쪽도 일부만 가능) */
export type PostListLabels = {
  caption: string
  title: string
  comments: string
  reactions: string
  views: string
  posted: string
  pinned: string
  status: Record<PostStatus, string>
  search: string
  searchPlaceholder: string
  searchSubmit: string
  sort: string
  sorts: Record<PostSort, string>
  loading: string
  errorTitle: string
  errorDescription: string
  retry: string
  emptyTitle: string
  emptyDescription: string
  noResultsTitle: string
  noResultsDescription: string
  clearSearch: string
  pagination: { label: string; previous: string; next: string; page: (n: number) => string }
}

export type PostListLabelsInput = Partial<
  Omit<PostListLabels, 'sorts' | 'pagination' | 'status'>
> & {
  status?: Partial<PostListLabels['status']>
  sorts?: Partial<PostListLabels['sorts']>
  pagination?: Partial<PostListLabels['pagination']>
}

export const defaultPostListLabels: PostListLabels = {
  caption: 'Posts',
  title: 'Title',
  comments: 'Comments',
  reactions: 'Reactions',
  views: 'Views',
  posted: 'Posted',
  pinned: 'Pinned',
  status: { DRAFT: 'Draft', PUBLISHED: 'Published', HIDDEN: 'Hidden', DELETED: 'Deleted' },
  search: 'Search',
  searchPlaceholder: 'Title or text',
  searchSubmit: 'Search',
  sort: 'Sort by',
  sorts: { latest: 'Latest', reactions: 'Most reactions', comments: 'Most comments' },
  loading: 'Loading',
  errorTitle: 'Could not load posts',
  errorDescription: 'Check your connection and try again.',
  retry: 'Try again',
  emptyTitle: 'No posts yet',
  emptyDescription: 'Be the first to write one.',
  noResultsTitle: 'No posts match',
  noResultsDescription: 'Try another search.',
  clearSearch: 'Clear search',
  pagination: {
    label: 'Pagination',
    previous: 'Previous page',
    next: 'Next page',
    page: (n) => `Page ${n}`,
  },
}

export function resolvePostListLabels(input: PostListLabelsInput = {}): PostListLabels {
  const { status, sorts, pagination, ...flat } = input
  return {
    ...defaultPostListLabels,
    ...flat,
    status: { ...defaultPostListLabels.status, ...status },
    sorts: { ...defaultPostListLabels.sorts, ...sorts },
    pagination: { ...defaultPostListLabels.pagination, ...pagination },
  }
}
