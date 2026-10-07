import { Button, Field, Input, Textarea } from '@skeleton/ui'
import { useCallback, useId, useState, type FormEvent } from 'react'
import { AuthorError, AuthorSlot } from './AuthorSlot'
import { focusAuthorSlot } from './focusAuthorSlot'
import type { AuthorPicker } from './authorship'
import { defaultPostEditorLabels, type PostEditorLabels } from './postEditorLabels'
import type { BoardConfig } from './types'
import styles from './PostEditor.module.css'

/** `authorId` 는 선택기에서 고른 값 — 선택기가 없거나 고르지 않았으면 키 자체가 없다 */
export type PostEditorValues = { title: string; body: string; authorId?: string }

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
  /**
   * 작성자 선택기 자리(제출 단추 옆) — 고른 id 가 제출 값의 `authorId` 로 간다. **`authorRequired` 가 true 일 때만 그려진다**
   * (서버가 필수로 하지 않으면 보낸 `authorId` 를 거절한다). 고치기 폼에는 주지 않는다 — 작성자는 불변
   */
  authorPicker?: AuthorPicker
  /**
   * `BoardConfig.authorRequired` — true 인데 고른 값이 없으면 칸 오류로 막는다. **`authorPicker` 가 없으면 막지 않는다**
   * (고를 수단이 없는 막다른 길이 된다 — 서버가 400 `BOARD.AUTHOR_REQUIRED` 로 답하니 앱이 선택기를 꽂아야 한다)
   */
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
  const labels = { ...defaultPostEditorLabels, ...input }
  const [values, setValues] = useState(initial)
  const [problems, setProblems] = useState<Partial<Record<keyof PostEditorValues, string>>>({})
  const [authorId, setAuthorId] = useState<string>()
  /** 「작성자를 안 골랐다」는 사실만 보관한다 — 문구는 그릴 때 지금의 `labels.authorRequired` 에서 읽는다(앱이 문구를 바꿔도 낡은 문장이 남지 않게) */
  const [authorMissing, setAuthorMissing] = useState(false)
  /** 선택기에 답이 필요한 질문이 떠 있다(`onUnsettledChange`) / 그 때문에 보내기를 막았다 */
  const [unsettled, setUnsettled] = useState(false)
  const [blockedUnsettled, setBlockedUnsettled] = useState(false)
  const authorErrorId = useId()
  const withAuthor = authorRequired === true && authorPicker !== undefined
  const authorProblem =
    unsettled && blockedUnsettled
      ? labels.authorUnsettled
      : authorMissing
        ? labels.authorRequired
        : fieldErrors?.authorId
  // 안정된 함수 — 선택기가 effect 의존에 넣어도 매 렌더 다시 돌지 않는다
  const changeAuthor = useCallback((next: string | undefined) => {
    setAuthorId(next)
    if (next) setAuthorMissing(false)
  }, [])
  const changeUnsettled = useCallback((next: boolean) => {
    setUnsettled(next)
    if (!next) setBlockedUnsettled(false)
  }, [])

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
    // 첫 오류 칸을 가리는 표식 — 그릴 때는 `authorMissing` · `blockedUnsettled` 로
    if (withAuthor && (!authorId || unsettled)) found.authorId = labels.authorRequired
    return found
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const found = check()
    setProblems(found)
    setAuthorMissing(found.authorId !== undefined && !authorId)
    setBlockedUnsettled(found.authorId !== undefined && authorId !== undefined)
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
        ...(withAuthor && authorId ? { authorId } : {}),
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
        {withAuthor && (
          <AuthorSlot
            picker={authorPicker}
            value={authorId}
            onChange={changeAuthor}
            threadAuthorId={undefined}
            threadLoading={false}
            onUnsettledChange={changeUnsettled}
            error={authorProblem}
            errorId={authorErrorId}
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
      {withAuthor && <AuthorError id={authorErrorId} message={authorProblem} />}
    </form>
  )
}
