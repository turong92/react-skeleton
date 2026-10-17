import { isErrorCode, ErrorCodes } from '@skeleton/api-client'
import { EmailWriteNotice, useAuth, useEmailBeforeWrite } from '@skeleton/auth'
import {
  AuthorScope,
  BoardComments,
  GuestFields,
  PostDetail,
  PostReactionBar,
  isRevisionStale,
  emptyGuestDraft,
  isOwn,
  useBoardConfig,
  useDecidePostRevision,
  useModeratePost,
  useOwnGuestIds,
  usePost,
  useRemovePost,
  type Board,
  type BoardConfig,
  type GuestDraft,
  type PostDetailData,
} from '@skeleton/board'
import { Alert, Button, Dialog, EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { emailRequired } from '../api/emailRequired'
import { useAuthorPicker } from '../author/useAuthorPicker'
import { useAuthLabels } from '../auth/useAuthLabels'
import { useProfileGate } from '../author/useProfileGate'
import { boardApi } from '../board/api'
import { GuestOwnerQueue } from '../board/GuestOwnerQueue'
import { storedGuestToken, useGuestUi } from '../board/guest'
import { REACTION_ICONS, commentLabels, postDetailLabels, reactionLabels } from '../board/labels'
import { guestPicturePicker, picturePicker } from '../board/picturePicker'
import { locate } from '../board/attachmentAccess'
import { BoardPicture } from '../board/BoardPicture'
import { useBoardCode } from '../board/useBoardCode'
import { LoadError } from '../components/LoadError'
import { useT } from '../i18n'
import { guestFieldLabels } from '../board/labels'
import styles from './BoardPostPage.module.css'

/** 글 + 반응 줄 + 댓글. 내 글이거나 운영자면 삭제, 내 글이면 수정, 운영자면 고정 · 숨김(`config.canModerate`) */
function PostView({
  code,
  id,
  post,
  config,
  board,
}: {
  code: string
  id: number
  post: PostDetailData
  config: BoardConfig
  board: Board | undefined
}) {
  const { t } = useT()
  const navigate = useNavigate()
  const labelsOfReactions = reactionLabels(t)
  const { principal } = useAuth()
  // 로그인하지 않은 사람(비회원)은 프로필 · 이메일 확인이 없다 — 이름 · 비밀번호로 쓴다
  const gate = useProfileGate(principal ? config : undefined)
  const authLabels = useAuthLabels()
  const authorPicker = useAuthorPicker(code, gate)
  const remove = useRemovePost(boardApi, code)
  const moderate = useModeratePost(boardApi, code, id)
  const decideRevision = useDecidePostRevision(boardApi, code, id)
  const [confirming, setConfirming] = useState(false)
  const emailBeforeWrite = useEmailBeforeWrite(emailRequired)
  const guest = useGuestUi(config, board, 'comments')
  const guestComments = useOwnGuestIds(`board:${code}:guest-comments`)
  const guestPosts = useOwnGuestIds(`board:${code}:guest-posts`)
  const [secret, setSecret] = useState<GuestDraft>(emptyGuestDraft)
  // 서버는 비회원을 모른다(`mine` 은 늘 false) - 이 브라우저가 비회원으로 쓴 글이면 화면이 자기가 가진 id 로 안다
  const guestOwned = post.authorGuest === true && guestPosts.ids.has(post.id)
  const mine = isOwn(post, principal?.accountId) || guestOwned // 서버가 준 `mine`(작성자 id 는 프로필 id 라 계정 id 와 비교하지 않는다)
  const secretKind = config.guestSecret ?? 'PASSWORD'

  async function confirmDelete() {
    const guestSecret = guestOwned
      ? secretKind === 'PASSWORD'
        ? secret.secret
        : storedGuestToken(secretKind)
      : undefined
    await remove.mutateAsync(guestSecret ? { id, guestSecret } : id)
    setConfirming(false)
    navigate('/board', { replace: true })
  }

  return (
    <AuthorScope>
      {isRevisionStale(decideRevision.error) && (
        <Alert tone="info">{t('board.revision.changed')}</Alert>
      )}
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
        renderAttachment={(key) => (
          <BoardPicture
            url={post.attachmentUrls?.[key]}
            access={() => {
              const at = locate(post.attachments, post.pendingRevision?.attachments, key)
              // 로그인하지 않았으면 이 브라우저가 쓴 글일 때만 비밀을 보낸다 (남의 글에 요청하지 않는다)
              if (!at || (!principal && !guestOwned)) return Promise.reject(new Error('no access'))
              const guestSecret = principal ? undefined : storedGuestToken(secretKind)
              return boardApi
                .postAttachmentAccess(code, id, at.index, { from: at.from, guestSecret })
                .then((r) => r.url)
            }}
          />
        )}
        onDecideRevision={
          config.canModerate && post.pendingRevision
            ? (decision, submittedAt) => decideRevision.mutate({ decision, submittedAt })
            : undefined
        }
        reactions={
          principal ? (
            <PostReactionBar
              api={boardApi}
              boardCode={code}
              post={post}
              config={config}
              groupLabel={t('board.reactions.group')}
              labels={labelsOfReactions}
              icons={REACTION_ICONS}
            />
          ) : undefined
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
        authorPicker={principal ? authorPicker : undefined}
        guest={guest}
        ownGuestIds={guestComments.ids}
        onGuestWritten={(c) => guestComments.add(c.id)}
        canManageComments={post.canManageComments}
        renderAttachment={(key, comment) => (
          <BoardPicture
            url={comment.attachmentUrls?.[key]}
            access={() => {
              const at = locate(comment.attachments, comment.pendingRevision?.attachments, key)
              if (!at) return Promise.reject(new Error('no access'))
              // 로그인하지 않았으면 이 브라우저가 쓴 댓글(작성자) 또는 쓴 글(글 주인)일 때만, 그 비밀 하나로 증명한다
              const asAuthor = guestComments.ids.has(comment.id)
              if (!principal && !asAuthor && !guestOwned)
                return Promise.reject(new Error('no access'))
              const options = principal
                ? { from: at.from }
                : {
                    from: at.from,
                    as: asAuthor ? ('author' as const) : ('owner' as const),
                    guestSecret: storedGuestToken(secretKind),
                  }
              return boardApi
                .commentAttachmentAccess(code, id, comment.id, at.index, options)
                .then((r) => r.url)
            }}
          />
        )}
        canReact={!!principal}
        attachmentPicker={principal ? picturePicker : guestPicturePicker}
        beforeDelete={emailBeforeWrite.ensure} // 삭제 확인 창을 열기 전에 이메일부터(창 안에서 막히면 이메일 화면이 창 밑에 깔린다)
        postAuthor={{
          authorId: post.authorId,
          mine: post.mine,
          authorDeleted: post.authorDeleted,
        }}
      />
      {guestOwned && board?.settings?.ownerModeratesComments && (
        <GuestOwnerQueue
          code={code}
          postId={id}
          token={secretKind === 'TOKEN' ? storedGuestToken(secretKind) : undefined}
        />
      )}
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
        {guestOwned && secretKind === 'PASSWORD' && (
          <>
            <p>{t('board.guest.deleteSecret')}</p>
            <GuestFields
              ui={{ secretKind, nameMaxLength: 20 }}
              labels={guestFieldLabels(t)}
              value={secret}
              onChange={setSecret}
              secretOnly
              idPrefix="post-delete"
            />
          </>
        )}
      </Dialog>
    </AuthorScope>
  )
}

function Loaded({ code, id, board }: { code: string; id: number; board: Board | undefined }) {
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
  return <PostView code={code} id={id} post={post.data} config={config.data} board={board} />
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
      {board.code && <Loaded code={board.code} id={id} board={board.board} />}
    </div>
  )
}
