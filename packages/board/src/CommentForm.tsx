import { Button, Field, Textarea } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { AuthorError, AuthorSlot } from './AuthorSlot'
import { focusAuthorSlot } from './focusAuthorSlot'
import type { AuthorPicker } from './authorship'
import styles from './CommentForm.module.css'

export type CommentFormProps = {
  /** 입력칸 라벨(보이는 글자) */
  label: string
  submitLabel: string
  /** 보내는 일 — 약속이 풀리면 끝난 것이고, 던지면(서버 오류) 쓴 글을 그대로 둔다. 오류 표시는 앱의 전역 핸들러 */
  onSubmit: (body: string, authorId?: string) => Promise<unknown> | void
  maxLength: number
  requiredMessage: string
  tooLongMessage: (max: number) => string
  initialValue?: string
  /** 있으면 취소 단추가 생긴다 */
  onCancel?: () => void
  cancelLabel?: string
  /** 보낸 뒤 칸을 비운다(새 댓글 칸) — 답글 · 수정 칸은 닫히므로 필요 없다 */
  clearOnSubmit?: boolean
  /** 열자마자 포커스(답글 · 수정 칸) */
  autoFocus?: boolean
  /** 작성자 선택기 자리(제출 단추 옆) — 고른 id 가 `onSubmit` 의 둘째 인자로 간다. 없으면 폼은 지금과 같다 */
  authorPicker?: AuthorPicker
  /** true 인데 고른 값이 없으면 칸 오류로 막는다(`BoardConfig.authorRequired`) */
  authorRequired?: boolean
  authorRequiredMessage?: string
  /** 이 스레드에서 내가 마지막으로 쓴 작성자 id — 선택기에 그대로 넘긴다 */
  threadAuthorId?: string
}

/** 댓글 한 칸 폼 — 새 댓글 · 답글 · 수정이 같이 쓴다. 비었거나 한도를 넘으면 칸 아래에 말하고 포커스를 둔다 */
export function CommentForm({
  label,
  submitLabel,
  onSubmit,
  maxLength,
  requiredMessage,
  tooLongMessage,
  initialValue = '',
  onCancel,
  cancelLabel,
  clearOnSubmit,
  autoFocus,
  authorPicker,
  authorRequired,
  authorRequiredMessage = 'Choose who to post as.',
  threadAuthorId,
}: CommentFormProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const [authorId, setAuthorId] = useState<string>()
  const [authorError, setAuthorError] = useState<string>()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const body = value.trim()
    const problem =
      body === ''
        ? requiredMessage
        : body.length > maxLength
          ? tooLongMessage(maxLength)
          : undefined
    const authorProblem = authorRequired && !authorId ? authorRequiredMessage : undefined
    setError(problem)
    setAuthorError(authorProblem)
    if (problem) {
      ;(form.elements.namedItem('body') as HTMLElement | null)?.focus()
      return
    }
    if (authorProblem) {
      focusAuthorSlot(form)
      return
    }
    setPending(true)
    try {
      await (authorId ? onSubmit(body, authorId) : onSubmit(body))
      if (clearOnSubmit) setValue('')
    } catch {
      // 쓴 글은 그대로 — 오류 토스트는 전역 핸들러가 띄운다
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className={styles.form}>
      <Field label={label} error={error}>
        {(control) => (
          <Textarea
            {...control}
            name="body"
            rows={3}
            autoFocus={autoFocus}
            value={value}
            onChange={(event) => setValue(event.target.value)}
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
              if (next) setAuthorError(undefined)
            }}
            threadAuthorId={threadAuthorId}
            invalid={authorError !== undefined}
            disabled={pending}
          />
        )}
        <Button type="submit" size="sm" loading={pending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
      </div>
      <AuthorError message={authorError} />
    </form>
  )
}
