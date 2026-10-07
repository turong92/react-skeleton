import { formatInstant } from '@skeleton/time'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Pagination,
  Spinner,
  Table,
  type TableColumn,
} from '@skeleton/ui'
import type { ReactNode } from 'react'
import { AuthorName } from './AuthorName'
import { collidingNames, type AuthorTagMode } from './authorDisplay'
import { resolvePostListLabels, type PostListLabelsInput } from './postListLabels'
import { PostListToolbar } from './PostListToolbar'
import { POST_SORTS, type PostSort, type PostSummary } from './types'
import styles from './PostList.module.css'

export type PostListProps = {
  posts: readonly PostSummary[]
  /** 현재 쪽(0 부터)과 전체 쪽 수 — 서버의 `pagination` */
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  sort: PostSort
  onSortChange: (sort: PostSort) => void
  /** 쓸 수 있는 정렬(기본 셋 모두) */
  sorts?: readonly PostSort[]
  /** 현재 검색어와 확정 콜백(빈 글자 = 검색 지우기) */
  query: string
  onSearch: (query: string) => void
  /** 글 링크 — 라우터의 `<Link>` 로(기본은 제목 글자만) */
  renderTitle?: (post: PostSummary) => ReactNode
  /** 목록 위 오른쪽(보통 「글쓰기」 단추) */
  actions?: ReactNode
  /** 처음부터 글이 없을 때 다음에 할 일(보통 「글쓰기」) */
  emptyAction?: ReactNode
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  formatTime?: (iso: string) => string
  labels?: PostListLabelsInput
  /** 작성자 꼬리표(`#4821`)를 보일 때 — 기본은 같은 목록에서 닉네임이 겹칠 때만 */
  authorTag?: AuthorTagMode
}

const total = (counts: PostSummary['reactionCounts']) =>
  Object.values(counts).reduce((sum, n) => sum + n, 0)

/** 글 목록 — 보이기만 한다(데이터 · 조건 · 호출은 부모). 고정 글은 알약, 초안 · 숨김 같은 상태도 알약으로 */
export function PostList({
  posts,
  page,
  totalPages,
  onPageChange,
  sort,
  onSortChange,
  sorts = POST_SORTS,
  query,
  onSearch,
  renderTitle = (post) => post.title,
  actions,
  emptyAction,
  loading,
  error,
  onRetry,
  formatTime = (iso) => formatInstant(iso),
  labels: input,
  authorTag,
}: PostListProps) {
  const labels = resolvePostListLabels(input)
  const colliding = collidingNames(posts)
  const columns: TableColumn<PostSummary>[] = [
    {
      key: 'title',
      header: labels.title,
      rowHeader: true,
      render: (post) => (
        <span className={styles.titleCell}>
          <span className={styles.titleLine}>
            {renderTitle(post)}
            {post.pinned && <Badge tone="info">{labels.pinned}</Badge>}
            {post.status !== 'PUBLISHED' && (
              <Badge tone={post.status === 'DRAFT' ? 'neutral' : 'warning'}>
                {labels.status[post.status]}
              </Badge>
            )}
          </span>
          {post.excerpt && <span className={styles.excerpt}>{post.excerpt}</span>}
        </span>
      ),
    },
    {
      key: 'author',
      header: labels.author,
      render: (post) => (
        <span className={styles.nowrap}>
          <AuthorName
            author={post}
            labels={labels}
            tag={authorTag}
            collides={colliding.has(post.authorName?.trim() ?? '')}
          />
        </span>
      ),
    },
    { key: 'comments', header: labels.comments, align: 'end', render: (post) => post.commentCount },
    {
      key: 'reactions',
      header: labels.reactions,
      align: 'end',
      render: (post) => total(post.reactionCounts),
    },
    { key: 'views', header: labels.views, align: 'end', render: (post) => post.viewCount },
    {
      key: 'posted',
      header: labels.posted,
      render: (post) => <span className={styles.nowrap}>{formatTime(post.createdAt)}</span>,
    },
  ]

  return (
    <div className={styles.list}>
      <div className={styles.top}>
        <PostListToolbar
          sort={sort}
          sorts={sorts}
          query={query}
          labels={labels}
          onSortChange={onSortChange}
          onSearch={onSearch}
        />
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {loading && <Spinner label={labels.loading} />}
      {error && (
        <Card title={labels.errorTitle}>
          <div role="alert" className={styles.error}>
            <p>{labels.errorDescription}</p>
            {onRetry && (
              <div>
                <Button variant="secondary" onClick={onRetry}>
                  {labels.retry}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
      {!loading && !error && (
        <>
          <Table
            caption={labels.caption}
            columns={columns}
            rows={posts}
            rowKey={(post) => String(post.id)}
            empty={
              query ? (
                <EmptyState
                  headingLevel={2}
                  title={labels.noResultsTitle}
                  description={labels.noResultsDescription}
                  action={
                    <Button variant="secondary" onClick={() => onSearch('')}>
                      {labels.clearSearch}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  headingLevel={2}
                  title={labels.emptyTitle}
                  description={labels.emptyDescription}
                  action={emptyAction}
                />
              )
            }
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            label={labels.pagination.label}
            previousLabel={labels.pagination.previous}
            nextLabel={labels.pagination.next}
            pageLabel={labels.pagination.page}
          />
        </>
      )}
    </div>
  )
}
