import { newIdempotencyKey } from '@skeleton/api-client'
import {
  PostEditor,
  useBoardConfig,
  useCreatePost,
  usePost,
  useUpdatePost,
  type AuthorPicker,
  type BoardConfig,
  type PostEditorValues,
} from '@skeleton/board'
import { EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuthorPicker } from '../author/useAuthorPicker'
import { useProfileGate } from '../author/useProfileGate'
import { boardApi } from '../board/api'
import { postEditorLabels } from '../board/labels'
import { useBoardCode } from '../board/useBoardCode'
import { fieldErrorsOf, isValidationFailure, type FieldErrors } from '../notes/formErrors'
import { createKeyRing } from '../notes/idempotencyKey'
import { useT } from '../i18n'
import styles from './BoardFormPage.module.css'

/** `PostEditor` 에 실패 처리를 잇는다 — 서버 400 의 칸별 오류는 같은 칸에, 그 밖의 실패는 폼 위 한 줄(입력은 그대로) */
function Editor({
  config,
  authorPicker,
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  config: BoardConfig
  /** 만들 때만 — 작성자는 불변이라 고치는 폼에는 선택기도 `authorRequired` 도 주지 않는다 */
  authorPicker?: AuthorPicker
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
      initial={initial}
      submitLabel={submitLabel}
      submitting={pending}
      error={failed ? t('board.form.failure') : undefined}
      fieldErrors={fieldErrors}
      labels={postEditorLabels(t)}
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

function CreatePost({ code, config }: { code: string; config: BoardConfig }) {
  const { t } = useT()
  const gate = useProfileGate(config)
  const authorPicker = useAuthorPicker(code)
  const navigate = useNavigate()
  const create = useCreatePost(boardApi, code)
  const keyFor = useRef(createKeyRing(newIdempotencyKey))
  return (
    <>
      <PageHeader
        title={t('board.form.createTitle')}
        description={t('board.form.createSubtitle')}
      />
      <Editor
        config={config}
        authorPicker={authorPicker}
        submitLabel={t('board.form.submitCreate')}
        onCancel={() => navigate('/board')}
        onSubmit={async (values) => {
          // 주소로 바로 들어온 경우에도 — 쓸 수 있는 프로필이 없으면 만들기 대화상자를 띄우고 보내지 않는다(쓴 글은 폼에 남는다)
          if (!gate.ensure()) return
          const post = await create.mutateAsync({
            input: values,
            idempotencyKey: keyFor.current(values),
          })
          navigate(`/board/${post.id}`)
        }}
      />
      {gate.dialog}
    </>
  )
}

function EditPost({ code, id, config }: { code: string; id: number; config: BoardConfig }) {
  const { t } = useT()
  const navigate = useNavigate()
  const post = usePost(boardApi, code, id)
  const update = useUpdatePost(boardApi, code, id)
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
  return (
    <>
      <PageHeader title={t('board.form.editTitle')} description={t('board.form.editSubtitle')} />
      <Editor
        config={config}
        initial={{ title: post.data.title, body: post.data.body }}
        submitLabel={t('board.form.submitEdit')}
        onCancel={() => navigate(`/board/${id}`)}
        onSubmit={async (values) => {
          await update.mutateAsync(values)
          navigate(`/board/${id}`)
        }}
      />
    </>
  )
}

function Loaded({ code }: { code: string }) {
  const { t } = useT()
  const { id } = useParams()
  const config = useBoardConfig(boardApi)
  if (config.isPending) return <Spinner label={t('common.loading')} />
  if (!config.data) return null
  return id ? (
    <EditPost code={code} id={Number(id)} config={config.data} />
  ) : (
    <CreatePost code={code} config={config.data} />
  )
}

/** `/board/new` 와 `/board/:id/edit` 가 같은 폼을 쓴다 — Patterns/Form page 의 게시판판 */
export function BoardFormPage() {
  const { t } = useT()
  const board = useBoardCode()
  return (
    <div className={styles.page}>
      {board.isPending && <Spinner label={t('common.loading')} />}
      {board.code && <Loaded code={board.code} />}
    </div>
  )
}
