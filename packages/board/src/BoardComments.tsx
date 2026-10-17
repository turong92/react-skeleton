import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Pagination,
  Select,
  Spinner,
} from '@skeleton/ui'
import { useMemo, useState } from 'react'
import { collidingNames } from './authorDisplay'
import { isUsableOwnAuthorId, lastOwnAuthorId, threadIsUnknown } from './authorship'
import type { BoardApi } from './boardApi'
import { resolveBoardCommentsLabels, type BoardCommentsLabelsInput } from './boardCommentsLabels'
import { CommentForm } from './CommentForm'
import { CommentThread } from './CommentThread'
import type { CommentSubmitExtra } from './commentExtras'
import type { CommentOptions } from './commentThreadContext'
import { GuestFields } from './GuestFields'
import { emptyGuestDraft, type GuestDraft } from './guestUi'
import {
  useComments,
  useCreateComment,
  useDecideCommentRevision,
  useModerateComment,
  useReaction,
  useRemoveComment,
  useUpdateComment,
} from './hooks'
import {
  COMMENT_SORTS,
  type BoardConfig,
  type BoardId,
  type Comment,
  type CommentInput,
  type CommentSort,
} from './types'
import styles from './BoardComments.module.css'

export type BoardCommentsProps = Omit<
  CommentOptions,
  | 'maxDepth'
  | 'commentMaxLength'
  | 'canModerate'
  | 'reactionTypes'
  | 'labels'
  | 'onReply'
  | 'onEdit'
  | 'onDelete'
  | 'onModerate'
  | 'onReact'
  | 'authorRequired'
  | 'threadAuthorId'
  | 'threadLoading'
  | 'maxAttachments'
  | 'onDecideRevision'
> & {
  api: BoardApi
  boardCode: string
  postId: BoardId
  /** 서버 설정(`useBoardConfig` 의 data) — 깊이 · 길이 한도 · 운영자 여부 · 반응 종류와 모드가 여기서 온다 */
  config: BoardConfig
  /** 최상위 댓글 한 쪽의 크기(기본 20, 서버의 `maxPageSize` 이하) */
  pageSize?: number
  /** false 면 새 댓글 칸이 없다(글이 숨김 · 초안일 때) */
  commentable?: boolean
  labels?: BoardCommentsLabelsInput
  /**
   * 새 댓글 · 답글 · 수정을 보내기 직전에 불린다 — `false` 를 돌려주면 보내지 않고 쓴 글은 그대로 남는다.
   * 앱이 먼저 해야 할 일이 있을 때(예: 닉네임이 없으면 정하는 대화상자를 띄우고 막는다)
   */
  beforeWrite?: () => boolean
  /**
   * 삭제 확인 창을 열기 직전에 불린다 — `false` 를 돌려주면 창을 열지 않는다. 확인 창은 네이티브 모달이라 그 안에서 막힌 쓰기(예: 이메일 등록이 필요해 403)의 화면이 창 **밑**에 깔린다 -
   * 막힐 일(이메일 등록 등)은 창을 열기 전에 푼다. `beforeWrite` 와 따로다: 지우는 것은 글을 쓰는 것이 아니라 닉네임 확인이 필요 없다
   */
  beforeDelete?: () => boolean
  /**
   * 이 댓글 영역이 달린 글의 작성자 — 글이 내 것(`mine`)이면 그 `authorId` 가 선택기의 처음 값 후보가 된다
   * (이 글에 댓글을 쓴 적이 없어도 같은 이름으로 이어 쓰게). 내 댓글이 있으면 댓글이 먼저다. 탈퇴 · `pending:` id 는 건너뛴다
   */
  postAuthor?: { authorId: string; mine?: boolean; authorDeleted?: boolean }
  /** 비회원이 댓글을 쓴 직후 — 앱이 그 id 를 기억해 두었다가 `ownGuestIds` 로 돌려주면 이 브라우저에서 고치기 · 지우기가 보인다 */
  onGuestWritten?: (comment: Comment) => void
  /** 글 주인이 비회원일 때 댓글 승인 · 가리기 · 고친 댓글 결정에 보내는 글의 비밀(헤더로만 나간다) */
  managerSecret?: string
}

/**
 * 댓글 영역(서버와 이어진 모양) — 최상위 댓글 쪽 · 정렬 · 새 댓글 · 답글 · 수정 · 삭제(확인 대화상자) · 운영자 숨김 · 반응(낙관적).
 * 오류 토스트는 앱의 QueryClient 전역 핸들러가 한다. 먼저 `CommentThread` 가 보이기만 하는 부분이다.
 */
export function BoardComments({
  api,
  boardCode,
  postId,
  config,
  pageSize = 20,
  commentable = true,
  labels: input,
  beforeWrite,
  beforeDelete,
  postAuthor,
  onGuestWritten,
  managerSecret,
  ...options
}: BoardCommentsProps) {
  const labels = resolveBoardCommentsLabels(input)
  const [sort, setSort] = useState<CommentSort>('oldest')
  const [page, setPage] = useState(0)
  const [deleting, setDeleting] = useState<BoardId | null>(null)
  const comments = useComments(api, boardCode, postId, { sort, page, size: pageSize })
  /** 이 쪽의 모든 줄기를 한 범위로 — 줄기가 달라도 같은 닉네임의 다른 작성자 id 면 꼬리표(데이터로 렌더 중에 계산한다) */
  const pageNames = useMemo(
    () => collidingNames((comments.data?.values ?? []).flatMap((root) => [root, ...root.replies])),
    [comments.data],
  )
  /** 이 글의 (이 쪽) 댓글에서 내가 마지막으로 쓴 작성자 id — 선택기의 처음 값을 정하는 단서 */
  const threadAuthorId = useMemo(
    () =>
      lastOwnAuthorId(comments.data?.values ?? []) ??
      (postAuthor && isUsableOwnAuthorId(postAuthor) ? postAuthor.authorId : undefined),
    [comments.data, postAuthor],
  )
  // 비회원은 작성자(프로필)를 고르지 않는다 — 서버가 `authorId` 를 보낸 비회원을 거절한다
  const authorRequired = config.authorRequired === true && options.guest === undefined
  /** 현재 쪽의 댓글을 아직 모른다(받는 중 · 이전 쪽 placeholder) — 이때의 undefined 는 「쓴 적 없음」이 아니다. 첫 불러오기 **실패**는 모름이 아니라 실패라 여기 들지 않는다 */
  const threadLoading = threadIsUnknown(comments)
  const create = useCreateComment(api, boardCode, postId)
  const update = useUpdateComment(api, boardCode, postId)
  const remove = useRemoveComment(api, boardCode, postId)
  const moderate = useModerateComment(api, boardCode, postId)
  const react = useReaction(api, boardCode, config.reactionMode)
  const decide = useDecideCommentRevision(api, boardCode, postId)
  /** 보낸 직후의 안내 — 비회원은 승인 대기 글을 다시 읽지 못하므로 (이름 · 본문과 함께) 이 자리에서만 보인다 */
  const [notice, setNotice] = useState<string>()
  const [justPosted, setJustPosted] = useState<Comment[]>([])
  const [deleteDraft, setDeleteDraft] = useState<GuestDraft>(emptyGuestDraft)
  const maxAttachments = config.commentMaxAttachments ?? 0
  const guest = options.guest
  const guestSecretOf = (secret?: string) =>
    secret ?? (guest?.secretKind === 'TOKEN' ? guest.token : undefined)
  /** 지우려는 댓글이 이 브라우저가 비회원으로 쓴 것이다 — 비밀을 함께 보낸다 */
  const guestDeleting =
    deleting !== null && options.ownGuestIds?.has(deleting) === true && guest !== undefined
  /** 막히면 던진다 — `CommentForm` 이 조용히 받아 쓴 글을 남긴다 */
  const allowed = async () => {
    if (beforeWrite && !beforeWrite()) throw new Error('write blocked by beforeWrite')
  }
  /** 새 댓글 · 답글 — 비회원이면 이름 · 비밀은 `extra.guest` 로 온다 */
  const write = async (
    body: string,
    parentId: BoardId | undefined,
    authorId: string | undefined,
    extra: CommentSubmitExtra | undefined,
  ) => {
    await allowed()
    const input: CommentInput = {
      body,
      ...(parentId === undefined ? {} : { parentId }),
      ...(authorId ? { authorId } : {}),
      ...(extra?.attachments ? { attachments: extra.attachments } : {}),
      ...(extra?.guest ? { guest: extra.guest } : {}),
    }
    const created = await create.mutateAsync({ input })
    if (extra?.guest) onGuestWritten?.(created)
    if (created.status === 'PENDING') {
      setNotice(extra?.guest ? labels.guestPending : labels.pendingNote)
      // 비회원은 승인 대기 댓글을 다시 읽지 못한다 — 방금 보낸 것을 이 자리에 둔다
      if (extra?.guest) setJustPosted((list) => [...list, created])
    }
    return created
  }

  return (
    <Card title={labels.heading}>
      <div className={styles.body}>
        {commentable && (
          <CommentForm
            clearOnSubmit
            label={labels.newComment}
            submitLabel={labels.postComment}
            maxLength={config.commentMaxLength}
            requiredMessage={labels.required}
            tooLongMessage={labels.tooLong}
            authorPicker={options.authorPicker}
            authorRequired={authorRequired}
            authorRequiredMessage={labels.authorRequired}
            authorUnsettledMessage={labels.authorUnsettled}
            threadAuthorId={threadAuthorId}
            threadLoading={threadLoading}
            guest={options.guest}
            guestLabels={labels}
            attachmentPicker={options.attachmentPicker}
            maxAttachments={maxAttachments}
            onSubmit={(body, authorId, extra) => write(body, undefined, authorId, extra)}
          />
        )}
        {notice && <Alert tone="info">{notice}</Alert>}
        {justPosted.length > 0 && (
          <ul className={styles.threads} aria-label={labels.pending}>
            {justPosted.map((c) => (
              <li key={c.id}>
                <Badge tone="warning">{labels.pending}</Badge> <strong>{c.authorName}</strong>{' '}
                <span>{labels.authorGuest}</span>
                <p>{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        <Field label={labels.sort}>
          {(control) => (
            <Select
              {...control}
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as CommentSort)
                setPage(0)
              }}
            >
              {COMMENT_SORTS.map((value) => (
                <option key={value} value={value}>
                  {labels.sorts[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {comments.isPending && <Spinner label={labels.loading} />}
        {comments.isError && (
          <div role="alert" className={styles.error}>
            <p>{labels.loadError}</p>
            <div>
              <Button variant="secondary" onClick={() => void comments.refetch()}>
                {labels.retry}
              </Button>
            </div>
          </div>
        )}
        {comments.data && comments.data.values.length === 0 && (
          <EmptyState headingLevel={3} title={labels.empty} />
        )}
        {comments.data && (
          <ul className={styles.threads}>
            {comments.data.values.map((thread) => (
              <li key={thread.id}>
                <CommentThread
                  {...options}
                  thread={thread}
                  scopeNames={pageNames}
                  authorRequired={authorRequired}
                  threadAuthorId={threadAuthorId}
                  threadLoading={threadLoading}
                  labels={labels}
                  maxDepth={config.maxCommentDepth}
                  commentMaxLength={config.commentMaxLength}
                  canModerate={config.canModerate}
                  maxAttachments={maxAttachments}
                  reactionTypes={config.reactionTypes}
                  onReply={
                    commentable
                      ? (parentId, body, authorId, extra) => write(body, parentId, authorId, extra)
                      : undefined
                  }
                  onEdit={async (id, body, extra) => {
                    await allowed()
                    const edited = (await update.mutateAsync({
                      id,
                      body,
                      ...(extra?.attachments ? { attachments: extra.attachments } : {}),
                      ...(guestSecretOf(extra?.guestSecret)
                        ? { guestSecret: guestSecretOf(extra?.guestSecret) }
                        : {}),
                    })) as Comment | undefined
                    if (edited?.pendingRevision && extra?.guestSecret !== undefined)
                      setNotice(labels.guestEditPending)
                    return edited
                  }}
                  onDelete={(id) => {
                    if (!beforeDelete || beforeDelete()) {
                      setDeleteDraft(emptyGuestDraft)
                      setDeleting(id)
                    }
                  }}
                  onModerate={(id, status) =>
                    moderate.mutate(
                      managerSecret ? { id, status, guestSecret: managerSecret } : { id, status },
                    )
                  }
                  onDecideRevision={(id, decision) =>
                    decide.mutate(
                      managerSecret
                        ? { id, decision, guestSecret: managerSecret }
                        : { id, decision },
                    )
                  }
                  onReact={(id, type, active) =>
                    react.mutate({
                      target: { kind: 'comment', postId, commentId: id },
                      type,
                      active,
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {comments.data && (
          <Pagination
            page={comments.data.pagination.page}
            totalPages={comments.data.pagination.totalPages}
            onPageChange={setPage}
            label={labels.pagination.label}
            previousLabel={labels.pagination.previous}
            nextLabel={labels.pagination.next}
            pageLabel={labels.pagination.page}
          />
        )}
      </div>
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={labels.confirmDeleteTitle}
        closeLabel={labels.close}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {labels.cancel}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => {
                if (deleting === null) return
                const secret = guestDeleting
                  ? guestSecretOf(deleteDraft.secret || undefined)
                  : undefined
                void remove
                  .mutateAsync(secret ? { id: deleting, guestSecret: secret } : deleting)
                  .then(
                    () => setDeleting(null),
                    () => setDeleting(null),
                  )
              }}
            >
              {labels.confirmDelete}
            </Button>
          </>
        }
      >
        <p>{labels.confirmDeleteBody}</p>
        {guestDeleting && guest?.secretKind === 'PASSWORD' && (
          <>
            <p>{labels.guestDeleteSecret}</p>
            <GuestFields
              ui={guest}
              labels={labels}
              value={deleteDraft}
              onChange={setDeleteDraft}
              secretOnly
              idPrefix="guest-delete"
            />
          </>
        )}
      </Dialog>
    </Card>
  )
}
