import { PostList, useBoardConfig, usePosts } from '@skeleton/board'
import { Button, EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProfileGate } from '../author/useProfileGate'
import { boardApi } from '../board/api'
import { paramsFromSearch, searchFromParams } from '../board/boardParams'
import { useBoardCode } from '../board/useBoardCode'
import { LoadError } from '../components/LoadError'
import { postListLabels } from '../board/labels'
import { TextLink } from '../components/TextLink'
import { useT } from '../i18n'
import styles from './BoardPage.module.css'

/** 글 목록 — `PostList`(보이기만 한다)에 `usePosts` 를 잇는다. 정렬 · 검색 · 쪽은 주소의 검색 인자에 둔다(새로고침 · 뒤로가기 · 공유) */
function Posts({ code }: { code: string }) {
  const { t } = useT()
  const navigate = useNavigate()
  const gate = useProfileGate(useBoardConfig(boardApi).data)
  const write = () => {
    // 쓸 수 있는 프로필이 없으면 먼저 만들게 한다(대화상자) — 만든 뒤 다시 누른다
    if (gate.ensure()) navigate('/board/new')
  }
  const [search, setSearch] = useSearchParams()
  const params = paramsFromSearch(search)
  const posts = usePosts(boardApi, code, params)
  const change = (patch: Partial<typeof params>) =>
    setSearch(searchFromParams({ ...params, ...patch }))
  return (
    <>
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
        renderTitle={(post) => <TextLink to={`/board/${post.id}`}>{post.title}</TextLink>}
        actions={<Button onClick={write}>{t('board.write')}</Button>}
        emptyAction={<Button onClick={write}>{t('board.writeFirst')}</Button>}
        labels={postListLabels(t)}
      />
      {gate.dialog}
    </>
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
