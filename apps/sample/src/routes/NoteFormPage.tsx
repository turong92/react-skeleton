import { newIdempotencyKey } from '@skeleton/api-client'
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from '@skeleton/ui'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createKeyRing } from '../notes/idempotencyKey'
import { fieldErrorsOf, isValidationFailure, type FieldErrors } from '../notes/formErrors'
import { useCreateNote, useNote, useUpdateNote } from '../notes/queries'
import { NOTE_STATUSES, type Note, type NoteInput, type NoteStatus } from '../notes/types'
import { useT } from '../i18n'
import styles from './NoteFormPage.module.css'

type Values = { title: string; body: string; status: NoteStatus; pinned: boolean }
type Status = 'idle' | 'pending' | 'failure'

const EMPTY: Values = { title: '', body: '', status: 'DRAFT', pinned: false }

/**
 * Patterns/Form page 를 옮긴 폼 — 제출 때 검증(첫 오류 칸으로 포커스) · 서버의 칸별 400 을 같은 칸에 · 제출 중 · 실패해도 입력 유지.
 * 성공하면 상세로 이동(확인 토스트는 따로 없다 — 백엔드가 알림을 발행해 실시간 토스트가 뜬다). 만들기는 내용마다 `Idempotency-Key` 하나(`createKeyRing`) — 더블클릭 · 재전송이 노트를 두 개 만들지 않고, 400 을 고쳐 다시 보내도 409 가 나지 않는다.
 */
function NoteForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Values
  submitLabel: string
  onSubmit: (values: Values) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useT()
  const [values, setValues] = useState<Values>(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  function focusFirst(form: HTMLFormElement, found: FieldErrors) {
    const first = Object.keys(found)[0]
    ;(form.elements.namedItem(first) as HTMLElement | null)?.focus()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const found: FieldErrors = values.title.trim() ? {} : { title: t('form.titleRequired') }
    setErrors(found)
    if (Object.keys(found).length > 0) return focusFirst(form, found)
    setStatus('pending')
    try {
      await onSubmit({ ...values, title: values.title.trim() })
    } catch (caught) {
      if (isValidationFailure(caught)) {
        const fromServer = fieldErrorsOf(caught)
        setErrors(fromServer)
        setStatus('idle')
        focusFirst(form, fromServer)
      } else {
        setStatus('failure')
      }
    }
  }

  return (
    <form onSubmit={submit} noValidate className={styles.form} aria-label={t('form.formLabel')}>
      {status === 'failure' && (
        <p role="alert" className={styles.failure}>
          {t('form.failure')}
        </p>
      )}
      <Card>
        <div className={styles.fields}>
          <Field
            label={t('form.title')}
            required
            requiredMark={t('form.required')}
            hint={t('form.titleHint')}
            error={errors.title}
          >
            {(control) => (
              <Input
                {...control}
                name="title"
                maxLength={80}
                value={values.title}
                onChange={(event) => set('title', event.target.value)}
              />
            )}
          </Field>
          <Field label={t('form.body')} hint={t('form.bodyHint')} error={errors.body}>
            {(control) => (
              <Textarea
                {...control}
                name="body"
                rows={8}
                value={values.body}
                onChange={(event) => set('body', event.target.value)}
              />
            )}
          </Field>
          <div className={styles.row}>
            <Field label={t('form.status')} error={errors.status}>
              {(control) => (
                <Select
                  {...control}
                  name="status"
                  value={values.status}
                  onChange={(event) => set('status', event.target.value as NoteStatus)}
                >
                  {NOTE_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {t(`status.${value}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Checkbox
              name="pinned"
              label={t('form.pinned')}
              description={t('form.pinnedHelp')}
              checked={values.pinned}
              onChange={(event) => set('pinned', event.target.checked)}
            />
          </div>
        </div>
      </Card>
      <div className={styles.actions}>
        <Button type="submit" loading={status === 'pending'} loadingLabel={t('form.saving')}>
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}

const inputOf = (values: Values, note?: Note): NoteInput => ({
  ...values,
  attachmentKey: note?.attachmentKey ?? null,
  attachmentName: note?.attachmentName ?? null,
})

function CreateNote() {
  const { t } = useT()
  const navigate = useNavigate()
  const create = useCreateNote()
  const keyFor = useRef(createKeyRing(newIdempotencyKey))
  return (
    <>
      <PageHeader title={t('form.createTitle')} description={t('form.createSubtitle')} />
      <NoteForm
        initial={EMPTY}
        submitLabel={t('form.submitCreate')}
        onCancel={() => navigate('/notes')}
        onSubmit={async (values) => {
          const note = await create.mutateAsync({
            input: inputOf(values),
            idempotencyKey: keyFor.current(values),
          })
          navigate(`/notes/${note.id}`)
        }}
      />
    </>
  )
}

function EditNote({ note }: { note: Note }) {
  const { t } = useT()
  const navigate = useNavigate()
  const update = useUpdateNote(note.id)
  return (
    <>
      <PageHeader title={t('form.editTitle')} description={t('form.editSubtitle')} />
      <NoteForm
        initial={{ title: note.title, body: note.body, status: note.status, pinned: note.pinned }}
        submitLabel={t('form.submitEdit')}
        onCancel={() => navigate(`/notes/${note.id}`)}
        onSubmit={async (values) => {
          await update.mutateAsync(inputOf(values, note))
          navigate(`/notes/${note.id}`)
        }}
      />
    </>
  )
}

function EditNoteLoader({ id }: { id: string }) {
  const { t } = useT()
  const note = useNote(id)
  if (note.isPending) return <Spinner label={t('common.loading')} />
  if (note.isError || !note.data)
    return (
      <EmptyState
        headingLevel={2}
        title={t('detail.notFoundTitle')}
        description={t('detail.notFoundBody')}
        action={<Link to="/notes">{t('detail.back')}</Link>}
      />
    )
  return <EditNote note={note.data} />
}

/** `/notes/new` 와 `/notes/:id/edit` 가 같은 폼을 쓴다 */
export function NoteFormPage() {
  const { id } = useParams()
  return <div className={styles.page}>{id ? <EditNoteLoader id={id} /> : <CreateNote />}</div>
}
