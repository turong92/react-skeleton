import { PostList, usePosts } from '@skeleton/board'
import { Button, EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { boardApi } from '../board/api'
import { paramsFromSearch, searchFromParams } from '../board/boardParams'
import { useBoardCode } from '../board/useBoardCode'
import { LoadError } from '../components/LoadError'
import { postListLabels } from '../board/labels'
import { useT } from '../i18n'
import styles from './BoardPage.module.css'

/** 글 목록 — `PostList`(보이기만 한다)에 `usePosts` 를 잇는다. 정렬 · 검색 · 쪽은 주소의 검색 인자에 둔다(새로고침 · 뒤로가기 · 공유) */
function Posts({ code }: { code: string }) {
  const { t } = useT()
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
      actions={<Button onClick={() => navigate('/board/new')}>{t('board.write')}</Button>}
      emptyAction={<Button onClick={() => navigate('/board/new')}>{t('board.writeFirst')}</Button>}
      labels={postListLabels(t)}
    />
  )
}

/** Patterns/List page 의 게시판판 — 정렬 · 검색 · 고정 글 · 쪽 이동 · 빈 상태 · 로딩 · 오류 */
export function BoardPage() {
  const { t } = useT()
  const board = useBoardCode()
  return (
    <div className={styles.page}>
      <PageHeader title={board.board?.name ?? t('board.title')} description={t('board.subtitle')} />
      {board.isPending && <Spinner label={t('common.loading')} />}
      {board.isError && <LoadError onRetry={() => void board.refetch()} />}
      {board.data && !board.code && (
        <EmptyState
          headingLevel={2}
          title={t('board.noBoardTitle')}
          description={t('board.noBoardBody')}
        />
      )}
      {board.code && <Posts code={board.code} />}
    </div>
  )
}
