import { newIdempotencyKey } from '@skeleton/api-client'
import {
  PostEditor,
  useBoardConfig,
  useCreatePost,
  usePost,
  useUpdatePost,
  type BoardConfig,
  type PostEditorLabels,
  type PostEditorValues,
} from '@skeleton/board'
import { EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { boardApi } from '../board/api'
import { useBoardCode } from '../board/useBoardCode'
import { fieldErrorsOf, isValidationFailure, type FieldErrors } from '../notes/formErrors'
import { createKeyRing } from '../notes/idempotencyKey'
import { strings } from '../strings'
import styles from './BoardFormPage.module.css'

const t = strings.board.form

const editorLabels: Partial<PostEditorLabels> = {
  title: t.title,
  body: t.body,
  requiredMark: t.required,
  titleHint: t.titleHint,
  bodyHint: t.bodyHint,
  titleRequired: t.titleRequired,
  bodyRequired: t.bodyRequired,
  titleTooLong: t.titleTooLong,
  bodyTooLong: t.bodyTooLong,
  cancel: strings.common.cancel,
  formLabel: t.formLabel,
}

/** `PostEditor` 에 실패 처리를 잇는다 — 서버 400 의 칸별 오류는 같은 칸에, 그 밖의 실패는 폼 위 한 줄(입력은 그대로) */
function Editor({
  config,
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  config: BoardConfig
  initial?: PostEditorValues
  submitLabel: string
  onCancel: () => void
  onSubmit: (values: PostEditorValues) => Promise<void>
}) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(false)
  return (
    <PostEditor
      limits={config}
      initial={initial}
      submitLabel={submitLabel}
      submitting={pending}
      error={failed ? t.failure : undefined}
      fieldErrors={fieldErrors}
      labels={editorLabels}
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
  const navigate = useNavigate()
  const create = useCreatePost(boardApi, code)
  const keyFor = useRef(createKeyRing(newIdempotencyKey))
  return (
    <>
      <PageHeader title={t.createTitle} description={t.createSubtitle} />
      <Editor
        config={config}
        submitLabel={t.submitCreate}
        onCancel={() => navigate('/board')}
        onSubmit={async (values) => {
          const post = await create.mutateAsync({
            input: values,
            idempotencyKey: keyFor.current(values),
          })
          navigate(`/board/${post.id}`)
        }}
      />
    </>
  )
}

function EditPost({ code, id, config }: { code: string; id: number; config: BoardConfig }) {
  const navigate = useNavigate()
  const post = usePost(boardApi, code, id)
  const update = useUpdatePost(boardApi, code, id)
  if (post.isPending) return <Spinner label={strings.common.loading} />
  if (post.isError || !post.data)
    return (
      <EmptyState
        headingLevel={2}
        title={strings.board.notFoundTitle}
        description={strings.board.notFoundBody}
        action={<Link to="/board">{strings.board.back}</Link>}
      />
    )
  return (
    <>
      <PageHeader title={t.editTitle} description={t.editSubtitle} />
      <Editor
        config={config}
        initial={{ title: post.data.title, body: post.data.body }}
        submitLabel={t.submitEdit}
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
  const { id } = useParams()
  const config = useBoardConfig(boardApi)
  if (config.isPending) return <Spinner label={strings.common.loading} />
  if (!config.data) return null
  return id ? (
    <EditPost code={code} id={Number(id)} config={config.data} />
  ) : (
    <CreatePost code={code} config={config.data} />
  )
}

/** `/board/new` 와 `/board/:id/edit` 가 같은 폼을 쓴다 — Patterns/Form page 의 게시판판 */
export function BoardFormPage() {
  const board = useBoardCode()
  return (
    <div className={styles.page}>
      {board.isPending && <Spinner label={strings.common.loading} />}
      {board.code && <Loaded code={board.code} />}
    </div>
  )
}
