import { newIdempotencyKey } from '@skeleton/api-client'
import {
  GuestFields,
  PostEditor,
  emptyGuestDraft,
  guestProblems,
  useBoardConfig,
  useCreatePost,
  useOwnGuestIds,
  usePost,
  useUpdatePost,
  type AuthorPicker,
  type Board,
  type BoardConfig,
  type GuestDraft,
  type GuestUi,
  type PostEditorValues,
} from '@skeleton/board'
import { EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { EmailWriteNotice, useAuth, useEmailBeforeWrite } from '@skeleton/auth'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { emailRequired } from '../api/emailRequired'
import { useAuthorPicker } from '../author/useAuthorPicker'
import { useAuthLabels } from '../auth/useAuthLabels'
import { useProfileGate } from '../author/useProfileGate'
import { boardApi } from '../board/api'
import { useGuestUi } from '../board/guest'
import { guestFieldLabels, postEditorLabels } from '../board/labels'
import { useBoardCode } from '../board/useBoardCode'
import { fieldErrorsOf, isValidationFailure, type FieldErrors } from '../notes/formErrors'
import { createKeyRing } from '../notes/idempotencyKey'
import { useT } from '../i18n'
import styles from './BoardFormPage.module.css'

/** `PostEditor` 에 실패 처리를 잇는다 — 서버 400 의 칸별 오류는 같은 칸에, 그 밖의 실패는 폼 위 한 줄(입력은 그대로) */
function Editor({
  config,
  guest,
  authorPicker,
  mustCreateProfile,
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  config: BoardConfig
  /** 로그인하지 않고 쓰는 새 글 — 이름 · 비밀번호 칸 */
  guest?: GuestUi
  /** 만들 때만 — 작성자는 불변이라 고치는 폼에는 선택기도 `authorRequired` 도 주지 않는다 */
  authorPicker?: AuthorPicker
  /** 이름 있는 프로필이 없어 고를 것이 없다 — 칸 오류 문구가 「먼저 만들어 주세요」 */
  mustCreateProfile?: boolean
  initial?: PostEditorValues
  submitLabel: string
  onCancel: () => void
  onSubmit: (values: PostEditorValues) => Promise<void>
}) {
  const { t } = useT()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(false)
  return (
    <PostEditor
      limits={config}
      authorPicker={authorPicker}
      authorRequired={authorPicker ? config.authorRequired : undefined}
      guest={guest}
      initial={initial}
      submitLabel={submitLabel}
      submitting={pending}
      error={failed ? t('board.form.failure') : undefined}
      fieldErrors={fieldErrors}
      labels={postEditorLabels(t, mustCreateProfile)}
      onCancel={onCancel}
      onSubmit={async (values) => {
        setPending(true)
        setFailed(false)
        setFieldErrors({})
        try {
          await onSubmit(values)
        } catch (caught) {
          if (isValidationFailure(caught)) setFieldErrors(fieldErrorsOf(caught))
          else setFailed(true)
        } finally {
          setPending(false)
        }
      }}
    />
  )
}

function CreatePost({
  code,
  config,
  board,
}: {
  code: string
  config: BoardConfig
  board: Board | undefined
}) {
  const { t } = useT()
  const { principal } = useAuth()
  const guest = useGuestUi(config, board, 'posts')
  const gate = useProfileGate(principal ? config : undefined)
  const authorPicker = useAuthorPicker(code, gate)
  const navigate = useNavigate()
  const create = useCreatePost(boardApi, code)
  const guestPosts = useOwnGuestIds(`board:${code}:guest-posts`)
  const [waiting, setWaiting] = useState(false)
  const keyFor = useRef(createKeyRing(newIdempotencyKey))
  // 주소를 입력하는 길로 곧장 들어온 사람(글쓰기 단추는 이미 이메일을 먼저 물었다)에게는 글을 쓰기 **전에** 알린다 - 다 쓴 뒤에야 막히면 제공자 왕복에서 글을 잃는다.
  // 「나중에 하기」로 닫으면 다시 열지 않는다(글을 내면 서버의 403 이 받는다). 띠는 늘 보이고 단추가 같은 화면을 연다
  const { needed, ensure } = useEmailBeforeWrite(emailRequired)
  const authLabels = useAuthLabels()
  useEffect(() => {
    if (needed) ensure()
  }, [needed, ensure])
  // 로그인하지도 않았고 비회원 쓰기도 막힌 게시판 - 로그인으로 보낸다
  if (!principal && !guest) return <Navigate to="/login" replace />
  // 비회원이 보낸 글이 승인을 기다린다 - 다시 읽을 수 없으니 이 자리에서 알린다
  if (waiting)
    return (
      <EmptyState
        headingLevel={2}
        title={t('board.guest.postPendingTitle')}
        description={t('board.guest.postPendingBody')}
        action={<Link to="/board">{t('board.back')}</Link>}
      />
    )
  return (
    <>
      <PageHeader
        title={t('board.form.createTitle')}
        description={t('board.form.createSubtitle')}
      />
      <EmailWriteNotice controller={emailRequired} labels={authLabels} />
      <Editor
        config={config}
        guest={guest}
        authorPicker={principal ? authorPicker : undefined}
        mustCreateProfile={gate.mustCreate}
        submitLabel={t('board.form.submitCreate')}
        onCancel={() => navigate('/board')}
        onSubmit={async (values) => {
          const post = await create.mutateAsync({
            input: values,
            idempotencyKey: keyFor.current(values),
          })
          if (values.guest) guestPosts.add(post.id)
          if (post.status === 'PENDING' && values.guest) setWaiting(true)
          else navigate(`/board/${post.id}`)
        }}
      />
      {gate.dialog}
    </>
  )
}

function EditPost({ code, id, config }: { code: string; id: number; config: BoardConfig }) {
  const { t } = useT()
  const navigate = useNavigate()
  const { principal } = useAuth()
  const post = usePost(boardApi, code, id)
  const update = useUpdatePost(boardApi, code, id)
  const guestPosts = useOwnGuestIds(`board:${code}:guest-posts`)
  const [secret, setSecret] = useState<GuestDraft>(emptyGuestDraft)
  const [secretChecked, setSecretChecked] = useState(false)
  const [waiting, setWaiting] = useState(false)
  if (post.isPending) return <Spinner label={t('common.loading')} />
  if (post.isError || !post.data)
    return (
      <EmptyState
        headingLevel={2}
        title={t('board.notFoundTitle')}
        description={t('board.notFoundBody')}
        action={<Link to="/board">{t('board.back')}</Link>}
      />
    )
  const secretKind = config.guestSecret ?? 'PASSWORD'
  // 이 브라우저가 비회원으로 쓴 글을 고친다 - 비밀번호(`PASSWORD`)를 다시 묻는다. 로그인하지 않았는데 남의 글이면 로그인으로
  const guestOwned = post.data.authorGuest === true && guestPosts.ids.has(id)
  if (!principal && !guestOwned) return <Navigate to="/login" replace />
  if (waiting)
    return (
      <EmptyState
        headingLevel={2}
        title={t('board.guest.editPending')}
        action={<Link to="/board">{t('board.back')}</Link>}
      />
    )
  const secretUi: GuestUi = { secretKind, nameMaxLength: 20 }
  const secretProblem =
    guestOwned &&
    Object.keys(guestProblems({ ...secret, name: 'x' }, secretUi, guestFieldLabels(t))).includes(
      'secret',
    )
  return (
    <>
      <PageHeader title={t('board.form.editTitle')} description={t('board.form.editSubtitle')} />
      {guestOwned && secretKind === 'PASSWORD' && (
        <GuestFields
          ui={secretUi}
          labels={guestFieldLabels(t)}
          value={secret}
          onChange={setSecret}
          showErrors={secretChecked}
          secretOnly
          idPrefix="post-edit"
        />
      )}
      <Editor
        config={config}
        initial={{ title: post.data.title, body: post.data.body }}
        submitLabel={t('board.form.submitEdit')}
        onCancel={() => navigate(`/board/${id}`)}
        onSubmit={async (values) => {
          if (guestOwned && secretKind === 'PASSWORD' && secretProblem) {
            setSecretChecked(true)
            return
          }
          const edited = await update.mutateAsync(
            guestOwned
              ? { ...values, guestSecret: secretKind === 'PASSWORD' ? secret.secret : undefined }
              : values,
          )
          // 비회원은 승인 대기 판을 다시 읽지 못한다 - 이 응답으로 알린다
          if (guestOwned && edited.pendingRevision) setWaiting(true)
          else navigate(`/board/${id}`)
        }}
      />
    </>
  )
}

function Loaded({ code, board }: { code: string; board: Board | undefined }) {
  const { t } = useT()
  const { id } = useParams()
  const config = useBoardConfig(boardApi)
  if (config.isPending) return <Spinner label={t('common.loading')} />
  if (!config.data) return null
  return id ? (
    <EditPost code={code} id={Number(id)} config={config.data} />
  ) : (
    <CreatePost code={code} config={config.data} board={board} />
  )
}

/** `/board/new` 와 `/board/:id/edit` 가 같은 폼을 쓴다 — Patterns/Form page 의 게시판판 */
export function BoardFormPage() {
  const { t } = useT()
  const board = useBoardCode()
  return (
    <div className={styles.page}>
      {board.isPending && <Spinner label={t('common.loading')} />}
      {board.code && <Loaded code={board.code} board={board.board} />}
    </div>
  )
}
