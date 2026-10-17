import { Button, Field, Textarea } from '@skeleton/ui'
import { useCallback, useId, useState, type FormEvent } from 'react'
import { AuthorError, AuthorSlot } from './AuthorSlot'
import type { AttachmentPicker, CommentSubmitExtra } from './commentExtras'
import { GuestFields } from './GuestFields'
import { defaultGuestLabels, type GuestLabels } from './guestLabels'
import {
  emptyGuestDraft,
  guestCredentials,
  guestProblems,
  MIN_GUEST_SECRET,
  type GuestDraft,
  type GuestUi,
} from './guestUi'
import { focusAuthorSlot } from './focusAuthorSlot'
import type { AuthorPicker } from './authorship'
import { defaultCommentLabels } from './commentLabels'
import styles from './CommentForm.module.css'

export type CommentFormProps = {
  /** 입력칸 라벨(보이는 글자) */
  label: string
  submitLabel: string
  /** 보내는 일 — 약속이 풀리면 끝난 것이고, 던지면(서버 오류) 쓴 글을 그대로 둔다. 오류 표시는 앱의 전역 핸들러 */
  onSubmit: (body: string, authorId?: string, extra?: CommentSubmitExtra) => Promise<unknown> | void
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
  /**
   * 작성자 선택기 자리(제출 단추 옆) — 고른 id 가 `onSubmit` 의 둘째 인자로 간다. **`authorRequired` 가 true 일 때만 그려진다**
   * (서버가 필수로 하지 않으면 보낸 `authorId` 를 거절한다). 수정 칸에는 주지 않는다 — 작성자는 불변
   */
  authorPicker?: AuthorPicker
  /**
   * `BoardConfig.authorRequired` — true 인데 고른 값이 없으면 칸 오류로 막는다. **`authorPicker` 가 없으면 막지 않는다**
   * (고를 수단이 없는 막다른 길이 된다 — 서버가 400 `BOARD.AUTHOR_REQUIRED` 로 답하니 앱이 선택기를 꽂아야 한다)
   */
  authorRequired?: boolean
  authorRequiredMessage?: string
  /** 선택기에 답이 필요한 질문이 떠 있는데 보내려 할 때의 문장 */
  authorUnsettledMessage?: string
  /** 이 스레드에서 내가 마지막으로 쓴 작성자 id — 선택기에 그대로 넘긴다 */
  threadAuthorId?: string
  /** 댓글을 아직 불러오는 중 — 선택기가 처음 값을 확정하지 않고 기다린다 */
  threadLoading?: boolean
  /** 로그인하지 않고 쓰는 새 댓글 · 답글 — 이름 · 비밀번호(· 캡차) 칸이 생기고 제출 값의 `extra.guest` 로 간다 */
  guest?: GuestUi
  /** 비회원이 자기 댓글을 고친다 — 비밀번호 칸만 묻고(`TOKEN` 이면 묻지 않고 앱의 토큰) `extra.guestSecret` 로 간다 */
  guestSecretFor?: GuestUi
  guestLabels?: GuestLabels
  /** 첨부 고르는 자리 — 업로드는 앱 몫이다 */
  attachmentPicker?: AttachmentPicker
  /** `BoardConfig.commentMaxAttachments` — 0 이면 자리를 그리지 않는다 */
  maxAttachments?: number
  initialAttachments?: string[]
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
  authorRequiredMessage = defaultCommentLabels.authorRequired,
  authorUnsettledMessage = defaultCommentLabels.authorUnsettled,
  threadAuthorId,
  threadLoading = false,
  guest,
  guestSecretFor,
  guestLabels = defaultGuestLabels,
  attachmentPicker,
  maxAttachments = 0,
  initialAttachments = [],
}: CommentFormProps) {
  const [guestDraft, setGuestDraft] = useState<GuestDraft>(emptyGuestDraft)
  const [guestChecked, setGuestChecked] = useState(false)
  const [attachments, setAttachments] = useState(initialAttachments)
  const withAttachments = attachmentPicker !== undefined && maxAttachments > 0
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const [authorId, setAuthorId] = useState<string>()
  /** 「작성자를 안 골랐다」는 사실만 보관한다 — 문구는 그릴 때 지금의 `authorRequiredMessage` 에서 읽는다(앱이 문구를 바꿔도 낡은 문장이 남지 않게) */
  const [authorMissing, setAuthorMissing] = useState(false)
  /** 선택기에 답이 필요한 질문이 떠 있다(`onUnsettledChange`) / 그 때문에 보내기를 막았다 */
  const [unsettled, setUnsettled] = useState(false)
  const [blockedUnsettled, setBlockedUnsettled] = useState(false)
  const authorErrorId = useId()
  const withAuthor = authorRequired === true && authorPicker !== undefined
  // 안정된 함수 — 선택기가 effect 의존에 넣어도 매 렌더 다시 돌지 않는다
  const changeAuthor = useCallback((next: string | undefined) => {
    setAuthorId(next)
    if (next) setAuthorMissing(false)
  }, [])
  const changeUnsettled = useCallback((next: boolean) => {
    setUnsettled(next)
    if (!next) setBlockedUnsettled(false)
  }, [])
  const authorMessage =
    unsettled && blockedUnsettled
      ? authorUnsettledMessage
      : authorMissing
        ? authorRequiredMessage
        : undefined

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
    const authorProblem = withAuthor && !authorId
    const blocked = withAuthor && !authorProblem && unsettled
    const guestProblem =
      (guest !== undefined &&
        Object.keys(guestProblems(guestDraft, guest, guestLabels)).length > 0) ||
      (guestSecretFor?.secretKind === 'PASSWORD' && guestDraft.secret.length < MIN_GUEST_SECRET)
    setGuestChecked(true)
    setError(problem)
    setAuthorMissing(authorProblem)
    setBlockedUnsettled(blocked)
    if (problem) {
      ;(form.elements.namedItem('body') as HTMLElement | null)?.focus()
      return
    }
    if (authorProblem || blocked) {
      focusAuthorSlot(form)
      return
    }
    if (guestProblem) return
    const extra: CommentSubmitExtra = {
      ...(guest ? { guest: guestCredentials(guestDraft, guest) } : {}),
      ...(guestSecretFor
        ? {
            guestSecret:
              guestSecretFor.secretKind === 'TOKEN' ? guestSecretFor.token : guestDraft.secret,
          }
        : {}),
      ...(withAttachments ? { attachments } : {}),
    }
    const hasExtra = Object.keys(extra).length > 0
    setPending(true)
    try {
      await (hasExtra
        ? onSubmit(body, withAuthor ? authorId : undefined, extra)
        : withAuthor && authorId
          ? onSubmit(body, authorId)
          : onSubmit(body))
      if (clearOnSubmit) {
        setValue('')
        setAttachments([])
        setGuestDraft((draft) => ({ ...emptyGuestDraft, name: draft.name }))
        setGuestChecked(false)
      }
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
      {guest && (
        <GuestFields
          ui={guest}
          labels={guestLabels}
          value={guestDraft}
          onChange={setGuestDraft}
          showErrors={guestChecked}
          idPrefix={`guest-${label}`}
        />
      )}
      {guestSecretFor && guestSecretFor.secretKind === 'PASSWORD' && (
        <GuestFields
          ui={guestSecretFor}
          labels={guestLabels}
          value={guestDraft}
          onChange={setGuestDraft}
          showErrors={guestChecked}
          secretOnly
          idPrefix={`guest-edit`}
        />
      )}
      {withAttachments &&
        attachmentPicker({ value: attachments, onChange: setAttachments, max: maxAttachments })}
      <div className={styles.actions}>
        {withAuthor && (
          <AuthorSlot
            picker={authorPicker}
            value={authorId}
            onChange={changeAuthor}
            threadAuthorId={threadAuthorId}
            threadLoading={threadLoading}
            onUnsettledChange={changeUnsettled}
            error={authorMessage}
            errorId={authorErrorId}
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
      {withAuthor && <AuthorError id={authorErrorId} message={authorMessage} />}
    </form>
  )
}
