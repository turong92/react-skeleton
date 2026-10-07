import { Button, Field, Input, Textarea } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { AuthorError, AuthorSlot } from './AuthorSlot'
import { focusAuthorSlot } from './focusAuthorSlot'
import type { AuthorPicker } from './authorship'
import type { BoardConfig } from './types'
import styles from './PostEditor.module.css'

/** `authorId` 는 선택기에서 고른 값 — 선택기가 없거나 고르지 않았으면 키 자체가 없다 */
export type PostEditorValues = { title: string; body: string; authorId?: string }

/** 글 폼의 글자 — 기본은 영어. 일부만 덮어쓰려면 `labels={{ title: '제목' }}` */
export type PostEditorLabels = {
  title: string
  body: string
  requiredMark: string
  titleHint: (max: number) => string
  bodyHint: (max: number) => string
  titleRequired: string
  bodyRequired: string
  titleTooLong: (max: number) => string
  bodyTooLong: (max: number) => string
  cancel: string
  formLabel: string
  /** `authorRequired` 인데 작성자를 고르지 않았을 때 */
  authorRequired: string
}

const defaultLabels: PostEditorLabels = {
  title: 'Title',
  body: 'Body',
  requiredMark: '*',
  titleHint: (max) => `Up to ${max} characters`,
  bodyHint: (max) => `Up to ${max} characters`,
  titleRequired: 'Enter a title.',
  bodyRequired: 'Write something in the body.',
  titleTooLong: (max) => `Keep the title within ${max} characters.`,
  bodyTooLong: (max) => `Keep the body within ${max} characters.`,
  cancel: 'Cancel',
  formLabel: 'Post',
  authorRequired: 'Choose who to post as.',
}

export type PostEditorProps = {
  /** 길이 한도 — 서버 설정(`BoardConfig`)의 값 */
  limits: Pick<BoardConfig, 'titleMaxLength' | 'bodyMaxLength'>
  initial?: PostEditorValues
  /** 검증을 통과한(다듬은) 값. 약속을 돌려주면 끝날 때까지 기다린다. 던진 오류는 삼킨다 — 표시는 부모가 `error` 로 */
  onSubmit: (values: PostEditorValues) => Promise<unknown> | void
  onCancel?: () => void
  /** 단추 글자(기본 `Publish`) — 고치기는 `Save changes` 처럼 */
  submitLabel?: string
  /** 보내는 중(부모의 mutation `isPending`) */
  submitting?: boolean
  /** 폼 전체의 실패 문장(입력은 그대로 남는다) */
  error?: string
  /** 서버가 칸마다 돌려준 오류 */
  fieldErrors?: Partial<Record<keyof PostEditorValues, string>>
  /** 작성자 선택기 자리(제출 단추 옆) — 고른 id 가 제출 값의 `authorId` 로 간다. 없으면 폼은 지금과 같다 */
  authorPicker?: AuthorPicker
  /** true 인데 고른 값이 없으면 칸 오류로 막는다(`BoardConfig.authorRequired`) */
  authorRequired?: boolean
  labels?: Partial<PostEditorLabels>
}

/** 글쓰기 · 고치기 폼 — 제출 때 검증(첫 오류 칸으로 포커스). Patterns/Form page 와 같은 모양 */
export function PostEditor({
  limits,
  initial = { title: '', body: '' },
  onSubmit,
  onCancel,
  submitLabel = 'Publish',
  submitting,
  error,
  fieldErrors,
  authorPicker,
  authorRequired,
  labels: input,
}: PostEditorProps) {
  const labels = { ...defaultLabels, ...input }
  const [values, setValues] = useState(initial)
  const [problems, setProblems] = useState<Partial<Record<keyof PostEditorValues, string>>>({})
  const [authorId, setAuthorId] = useState<string>()

  function check(): typeof problems {
    const found: typeof problems = {}
    const title = values.title.trim()
    const body = values.body.trim()
    if (!title) found.title = labels.titleRequired
    else if (title.length > limits.titleMaxLength)
      found.title = labels.titleTooLong(limits.titleMaxLength)
    if (!body) found.body = labels.bodyRequired
    else if (body.length > limits.bodyMaxLength)
      found.body = labels.bodyTooLong(limits.bodyMaxLength)
    if (authorRequired && !authorId) found.authorId = labels.authorRequired
    return found
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const found = check()
    setProblems(found)
    const first = Object.keys(found)[0]
    if (first === 'authorId') {
      focusAuthorSlot(form)
      return
    }
    if (first) {
      ;(form.elements.namedItem(first) as HTMLElement | null)?.focus()
      return
    }
    try {
      await onSubmit({
        title: values.title.trim(),
        body: values.body.trim(),
        ...(authorId ? { authorId } : {}),
      })
    } catch {
      // 표시는 부모가 `error` · `fieldErrors` 로 한다
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label={labels.formLabel} className={styles.form}>
      {error && (
        <p role="alert" className={styles.failure}>
          {error}
        </p>
      )}
      <Field
        label={labels.title}
        required
        requiredMark={labels.requiredMark}
        hint={labels.titleHint(limits.titleMaxLength)}
        error={problems.title ?? fieldErrors?.title}
      >
        {(control) => (
          <Input
            {...control}
            name="title"
            value={values.title}
            onChange={(event) => setValues((v) => ({ ...v, title: event.target.value }))}
          />
        )}
      </Field>
      <Field
        label={labels.body}
        required
        requiredMark={labels.requiredMark}
        hint={labels.bodyHint(limits.bodyMaxLength)}
        error={problems.body ?? fieldErrors?.body}
      >
        {(control) => (
          <Textarea
            {...control}
            name="body"
            rows={10}
            value={values.body}
            onChange={(event) => setValues((v) => ({ ...v, body: event.target.value }))}
          />
        )}
      </Field>
      <div className={styles.actions}>
        {authorPicker && (
          <AuthorSlot
            picker={authorPicker}
            value={authorId}
            onChange={(next) => {
              setAuthorId(next)
              if (next) setProblems((p) => ({ ...p, authorId: undefined }))
            }}
            threadAuthorId={undefined}
            invalid={problems.authorId !== undefined}
            disabled={submitting === true}
          />
        )}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {labels.cancel}
          </Button>
        )}
      </div>
      <AuthorError message={problems.authorId ?? fieldErrors?.authorId} />
    </form>
  )
}
