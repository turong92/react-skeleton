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
  type BoardConfig,
  type PostDetailData,
} from '@skeleton/board'
import { Button, Dialog, EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useNicknameGate } from '../auth/nicknameGateContext'
import { boardApi } from '../board/api'
import { REACTION_ICONS, commentLabels, postDetailLabels, reactionLabels } from '../board/labels'
import { useBoardCode } from '../board/useBoardCode'
import { LoadError } from '../components/LoadError'
import { useT } from '../i18n'
import styles from './BoardPostPage.module.css'

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
  const { t } = useT()
  const navigate = useNavigate()
  const labelsOfReactions = reactionLabels(t)
  const { principal } = useAuth()
  const gate = useNicknameGate()
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
        labels={postDetailLabels(t)}
        onEdit={mine ? () => navigate(`/board/${id}/edit`) : undefined}
        onDelete={mine || config.canModerate ? () => setConfirming(true) : undefined}
        onModerate={config.canModerate ? (moderation) => moderate.mutate(moderation) : undefined}
        reactions={
          <PostReactionBar
            api={boardApi}
            boardCode={code}
            post={post}
            config={config}
            groupLabel={t('board.reactions.group')}
            labels={labelsOfReactions}
            icons={REACTION_ICONS}
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
        reactionLabels={labelsOfReactions}
        reactionIcons={REACTION_ICONS}
        labels={commentLabels(t)}
        beforeWrite={gate.ensure}
      />
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('board.detail.deleteTitle', { title: post.title })}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => void confirmDelete()}
            >
              {t('board.detail.deleteConfirm')}
            </Button>
          </>
        }
      >
        <p>{t('board.detail.deleteBody')}</p>
      </Dialog>
    </>
  )
}

function Loaded({ code, id }: { code: string; id: number }) {
  const { t } = useT()
  const config = useBoardConfig(boardApi)
  const post = usePost(boardApi, code, id)
  if (post.isPending || config.isPending) return <Spinner label={t('common.loading')} />
  if (post.isError && isErrorCode(post.error, ErrorCodes.BOARD_POST_NOT_FOUND))
    return (
      <EmptyState
        headingLevel={2}
        title={t('board.notFoundTitle')}
        description={t('board.notFoundBody')}
        action={<Link to="/board">{t('board.back')}</Link>}
      />
    )
  if (post.isError || config.isError || !post.data || !config.data)
    return <LoadError onRetry={() => void post.refetch()} />
  return <PostView code={code} id={id} post={post.data} config={config.data} />
}

/** Patterns/Detail page 의 게시판판 — 글 + 반응 + 댓글(대댓글) · 삭제는 확인 · 로딩 · 없음(`BOARD.POST_NOT_FOUND`) */
export function BoardPostPage() {
  const { t } = useT()
  const id = Number(useParams().id) // 주소의 글 번호(숫자가 아니면 NaN → 서버가 없는 글로 답한다)
  const board = useBoardCode()
  return (
    <div className={styles.page}>
      <PageHeader
        title={board.board?.name ?? t('board.title')}
        back={<Link to="/board">← {t('board.back')}</Link>}
      />
      {board.isPending && <Spinner label={t('common.loading')} />}
      {board.code && <Loaded code={board.code} id={id} />}
    </div>
  )
}
