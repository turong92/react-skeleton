import { isErrorCode, ErrorCodes } from '@skeleton/api-client'
import { useAuth } from '@skeleton/auth'
import {
  BoardComments,
  PostDetail,
  PostReactionBar,
  useBoardConfig,
  useModeratePost,
  usePost,
  useRemovePost,
  type BoardCommentsLabelsInput,
  type BoardConfig,
  type PostDetailData,
} from '@skeleton/board'
import { Button, Dialog, EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { boardApi } from '../board/api'
import { useBoardCode } from '../board/useBoardCode'
import { LoadError } from '../components/LoadError'
import { strings } from '../strings'
import styles from './BoardPostPage.module.css'

const t = strings.board
const { reactions } = t

const commentLabels: BoardCommentsLabelsInput = {
  ...t.comments,
  reactionGroup: reactions.group,
  loading: strings.common.loading,
  retry: strings.common.retry,
  cancel: strings.common.cancel,
  close: strings.common.close,
  pagination: { label: strings.notes.pagination.label, page: (n) => `${n}쪽` },
}

/** 글 + 반응 줄 + 댓글. 내 글이거나 운영자면 삭제, 내 글이면 수정, 운영자면 고정 · 숨김(`config.canModerate`) */
function PostView({
  code,
  id,
  post,
  config,
}: {
  code: string
  id: number
  post: PostDetailData
  config: BoardConfig
}) {
  const navigate = useNavigate()
  const { principal } = useAuth()
  const remove = useRemovePost(boardApi, code)
  const moderate = useModeratePost(boardApi, code, id)
  const [confirming, setConfirming] = useState(false)
  const mine = principal?.accountId === post.authorId

  async function confirmDelete() {
    await remove.mutateAsync(id)
    setConfirming(false)
    navigate('/board', { replace: true })
  }

  return (
    <>
      <PostDetail
        post={post}
        labels={{ ...t.detail, pinned: t.list.pinned, status: t.list.status }}
        onEdit={mine ? () => navigate(`/board/${id}/edit`) : undefined}
        onDelete={mine || config.canModerate ? () => setConfirming(true) : undefined}
        onModerate={config.canModerate ? (moderation) => moderate.mutate(moderation) : undefined}
        reactions={
          <PostReactionBar
            api={boardApi}
            boardCode={code}
            post={post}
            config={config}
            groupLabel={reactions.group}
            labels={reactions.labels}
            icons={reactions.icons}
          />
        }
      />
      <BoardComments
        api={boardApi}
        boardCode={code}
        postId={id}
        config={config}
        commentable={post.status === 'PUBLISHED'}
        currentUserId={principal?.accountId}
        reactionLabels={reactions.labels}
        reactionIcons={reactions.icons}
        labels={commentLabels}
      />
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t.detail.deleteTitle(post.title)}
        closeLabel={strings.common.close}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {strings.common.cancel}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => void confirmDelete()}
            >
              {t.detail.deleteConfirm}
            </Button>
          </>
        }
      >
        <p>{t.detail.deleteBody}</p>
      </Dialog>
    </>
  )
}

function Loaded({ code, id }: { code: string; id: number }) {
  const config = useBoardConfig(boardApi)
  const post = usePost(boardApi, code, id)
  if (post.isPending || config.isPending) return <Spinner label={strings.common.loading} />
  if (post.isError && isErrorCode(post.error, ErrorCodes.BOARD_POST_NOT_FOUND))
    return (
      <EmptyState
        headingLevel={2}
        title={t.notFoundTitle}
        description={t.notFoundBody}
        action={<Link to="/board">{t.back}</Link>}
      />
    )
  if (post.isError || config.isError || !post.data || !config.data)
    return <LoadError onRetry={() => void post.refetch()} />
  return <PostView code={code} id={id} post={post.data} config={config.data} />
}

/** Patterns/Detail page 의 게시판판 — 글 + 반응 + 댓글(대댓글) · 삭제는 확인 · 로딩 · 없음(`BOARD.POST_NOT_FOUND`) */
export function BoardPostPage() {
  const id = Number(useParams().id) // 주소의 글 번호(숫자가 아니면 NaN → 서버가 없는 글로 답한다)
  const board = useBoardCode()
  return (
    <div className={styles.page}>
      <PageHeader title={board.board?.name ?? t.title} back={<Link to="/board">← {t.back}</Link>} />
      {board.isPending && <Spinner label={strings.common.loading} />}
      {board.code && <Loaded code={board.code} id={id} />}
    </div>
  )
}
