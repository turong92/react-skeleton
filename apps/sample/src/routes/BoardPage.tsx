import { PostList, useBoardConfig, usePosts, type Board } from '@skeleton/board'
import { Button, EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { useAuth } from '@skeleton/auth'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEmailBeforeWrite } from '@skeleton/auth'
import { emailRequired } from '../api/emailRequired'
import { ensureInOrder } from '../author/ensureInOrder'
import { useProfileGate } from '../author/useProfileGate'
import { boardApi } from '../board/api'
import { paramsFromSearch, searchFromParams } from '../board/boardParams'
import { useGuestUi } from '../board/guest'
import { useBoardCode } from '../board/useBoardCode'
import { LoadError } from '../components/LoadError'
import { postListLabels } from '../board/labels'
import { TextLink } from '../components/TextLink'
import { useT } from '../i18n'
import styles from './BoardPage.module.css'

/** 글 목록 — `PostList`(보이기만 한다)에 `usePosts` 를 잇는다. 정렬 · 검색 · 쪽은 주소의 검색 인자에 둔다(새로고침 · 뒤로가기 · 공유) */
function Posts({ code, board }: { code: string; board: Board | undefined }) {
  const { t } = useT()
  const navigate = useNavigate()
  const { principal } = useAuth()
  const config = useBoardConfig(boardApi).data
  // 로그인하지 않은 사람은 프로필 · 이메일 확인이 없다 - 게시판이 비회원 글쓰기를 허락할 때만 쓰기 단추가 있다
  const gate = useProfileGate(principal ? config : undefined)
  const guestWrites = useGuestUi(config, board, 'posts') !== undefined
  const canWrite = Boolean(principal) || guestWrites
  const emailBeforeWrite = useEmailBeforeWrite(emailRequired)
  const write = () => {
    if (!principal) {
      navigate('/board/new')
      return
    }
    // 쓰기 전 확인은 차례로 하나씩: 이메일(쓰기 때 방식의 서버에서 주소가 없으면 등록 화면) → 닉네임(쓸 수 있는 프로필이 없으면 만들게 하는 대화상자) — 끝낸 뒤 다시 누른다
    if (ensureInOrder(emailBeforeWrite.ensure, gate.ensure)) navigate('/board/new')
  }
  const [search, setSearch] = useSearchParams()
  const params = paramsFromSearch(search)
  // 운영자의 대기 목록 - 승인을 기다리는 새 글 / 고친 내용이 기다리는 글(목록 줄에서 글을 열면 공개본과 나란히 비교한다)
  const queue = config?.canModerate ? search.get('queue') : null
  const posts = usePosts(
    boardApi,
    code,
    queue === 'pending'
      ? { ...params, status: 'PENDING' }
      : queue === 'revisions'
        ? { ...params, revision: 'pending' }
        : params,
  )
  const pickQueue = (next: 'pending' | 'revisions' | null) => {
    const keep = searchFromParams({ ...params, page: 0 })
    if (next) keep.set('queue', next)
    setSearch(keep)
  }
  const change = (patch: Partial<typeof params>) => {
    const next = searchFromParams({ ...params, ...patch })
    if (queue) next.set('queue', queue)
    setSearch(next)
  }
  return (
    <>
      {config?.canModerate && (
        <div role="group" aria-label={t('board.queue.label')}>
          <Button size="sm" variant={queue ? 'ghost' : 'secondary'} onClick={() => pickQueue(null)}>
            {t('board.queue.all')}
          </Button>{' '}
          <Button
            size="sm"
            variant={queue === 'pending' ? 'secondary' : 'ghost'}
            onClick={() => pickQueue('pending')}
          >
            {t('board.queue.pending')}
          </Button>{' '}
          <Button
            size="sm"
            variant={queue === 'revisions' ? 'secondary' : 'ghost'}
            onClick={() => pickQueue('revisions')}
          >
            {t('board.queue.revisions')}
          </Button>
        </div>
      )}
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
        actions={canWrite ? <Button onClick={write}>{t('board.write')}</Button> : undefined}
        emptyAction={
          canWrite ? <Button onClick={write}>{t('board.writeFirst')}</Button> : undefined
        }
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
      {board.code && <Posts code={board.code} board={board.board} />}
    </div>
  )
}
