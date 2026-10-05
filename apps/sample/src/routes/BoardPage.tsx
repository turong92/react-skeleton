import { PostList, usePosts, type PostListLabelsInput } from '@skeleton/board'
import { Button, EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { boardApi } from '../board/api'
import { paramsFromSearch, searchFromParams } from '../board/boardParams'
import { useBoardCode } from '../board/useBoardCode'
import { LoadError } from '../components/LoadError'
import { strings } from '../strings'
import styles from './BoardPage.module.css'

const t = strings.board

const listLabels: PostListLabelsInput = {
  ...t.list,
  loading: strings.common.loading,
  retry: strings.common.retry,
  pagination: {
    label: strings.notes.pagination.label,
    previous: strings.notes.pagination.previous,
    next: strings.notes.pagination.next,
    page: (n) => `${n}쪽`,
  },
}

/** 글 목록 — `PostList`(보이기만 한다)에 `usePosts` 를 잇는다. 정렬 · 검색 · 쪽은 주소의 검색 인자에 둔다(새로고침 · 뒤로가기 · 공유) */
function Posts({ code }: { code: string }) {
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const params = paramsFromSearch(search)
  const posts = usePosts(boardApi, code, params)
  const change = (patch: Partial<typeof params>) =>
    setSearch(searchFromParams({ ...params, ...patch }))
  return (
    <PostList
      posts={posts.data?.values ?? []}
      loading={posts.isPending}
      error={posts.isError}
      onRetry={() => void posts.refetch()}
      page={posts.data?.pagination.page ?? 0}
      totalPages={posts.data?.pagination.totalPages ?? 0}
      onPageChange={(page) => change({ page })}
      sort={params.sort}
      onSortChange={(sort) => change({ sort, page: 0 })}
      query={params.q}
      onSearch={(q) => change({ q, page: 0 })}
      renderTitle={(post) => <Link to={`/board/${post.id}`}>{post.title}</Link>}
      actions={<Button onClick={() => navigate('/board/new')}>{t.write}</Button>}
      emptyAction={<Button onClick={() => navigate('/board/new')}>{t.writeFirst}</Button>}
      labels={listLabels}
    />
  )
}

/** Patterns/List page 의 게시판판 — 정렬 · 검색 · 고정 글 · 쪽 이동 · 빈 상태 · 로딩 · 오류 */
export function BoardPage() {
  const board = useBoardCode()
  return (
    <div className={styles.page}>
      <PageHeader title={board.board?.name ?? t.title} description={t.subtitle} />
      {board.isPending && <Spinner label={strings.common.loading} />}
      {board.isError && <LoadError onRetry={() => void board.refetch()} />}
      {board.data && !board.code && (
        <EmptyState headingLevel={2} title={t.noBoardTitle} description={t.noBoardBody} />
      )}
      {board.code && <Posts code={board.code} />}
    </div>
  )
}
