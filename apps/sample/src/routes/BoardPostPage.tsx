import { isErrorCode, ErrorCodes } from '@skeleton/api-client'
import { EmailWriteNotice, useAuth, useEmailBeforeWrite } from '@skeleton/auth'
import {
  AuthorScope,
  BoardComments,
  PostDetail,
  PostReactionBar,
  isOwn,
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
import { emailRequired } from '../api/emailRequired'
import { useAuthorPicker } from '../author/useAuthorPicker'
import { useAuthLabels } from '../auth/useAuthLabels'
import { useProfileGate } from '../author/useProfileGate'
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
  const gate = useProfileGate(config)
  const authLabels = useAuthLabels()
  const authorPicker = useAuthorPicker(code, gate)
  const remove = useRemovePost(boardApi, code)
  const moderate = useModeratePost(boardApi, code, id)
  const [confirming, setConfirming] = useState(false)
  const emailBeforeWrite = useEmailBeforeWrite(emailRequired)
  const mine = isOwn(post, principal?.accountId) // 서버가 준 `mine`(작성자 id 는 프로필 id 라 계정 id 와 비교하지 않는다)

  async function confirmDelete() {
    await remove.mutateAsync(id)
    setConfirming(false)
    navigate('/board', { replace: true })
  }

  return (
    <AuthorScope>
      <PostDetail
        post={post}
        labels={postDetailLabels(t)}
        onEdit={mine ? () => navigate(`/board/${id}/edit`) : undefined}
        // 확인 창(네이티브 모달) 안에서 삭제가 이메일 403 에 붙잡히면 이메일 화면이 창 밑에 깔린다 - 창을 열기 전에 이메일부터
        onDelete={
          mine || config.canModerate
            ? () => emailBeforeWrite.ensure() && setConfirming(true)
            : undefined
        }
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
      {/* 쓰기 때 방식의 서버에서 주소가 없는 계정에게만 보이는, 막지 않는 띠 - 댓글은 그대로 쓸 수 있고 내면 이메일 등록 뒤 같은 댓글이 올라간다 */}
      <EmailWriteNotice controller={emailRequired} labels={authLabels} />
      <BoardComments
        key={post.id} // 선택기가 있는 폼은 값을 쥐고 있다 — 글이 바뀌면 고른 값 · 오류가 남지 않게 새로 만든다
        api={boardApi}
        boardCode={code}
        postId={id}
        config={config}
        commentable={post.status === 'PUBLISHED'}
        currentUserId={principal?.accountId}
        reactionLabels={labelsOfReactions}
        reactionIcons={REACTION_ICONS}
        labels={commentLabels(t, gate.mustCreate)}
        authorPicker={authorPicker}
        beforeDelete={emailBeforeWrite.ensure} // 삭제 확인 창을 열기 전에 이메일부터(창 안에서 막히면 이메일 화면이 창 밑에 깔린다)
        postAuthor={{
          authorId: post.authorId,
          mine: post.mine,
          authorDeleted: post.authorDeleted,
        }}
      />
      {gate.dialog}
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
    </AuthorScope>
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
