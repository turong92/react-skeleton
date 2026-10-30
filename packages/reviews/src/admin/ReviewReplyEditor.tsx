import { Button, ConfirmDialog, Field, Textarea } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { defaultReviewsAdminLabels, type ReviewsAdminLabels } from './labels'
import type { ReviewReply } from '../types'
import styles from './AdminReviewQueue.module.css'

export type ReviewReplyEditorProps = {
  /** 지금 달린 답글 - 리뷰당 하나라 있으면 그 자리에서 고친다 */
  reply: ReviewReply | null
  /** 저장 - 약속이 풀리면 끝, 던지면 쓴 글을 그대로 둔다(오류 표시는 앱의 전역 핸들러) */
  onSave: (body: string) => Promise<unknown> | void
  /** 지우기(확인 창 뒤에). 없으면(권한 없음) 삭제 단추가 없다 */
  onRemove?: () => Promise<unknown> | void
  onCancel?: () => void
  labels?: ReviewsAdminLabels
}

/** 운영자 답글 폼 — 본문(필수) + 저장 / 삭제. `review.reply` 권한 확인은 부르는 쪽 */
export function ReviewReplyEditor({
  reply,
  onSave,
  onRemove,
  onCancel,
  labels = defaultReviewsAdminLabels,
}: ReviewReplyEditorProps) {
  const t = labels.replyEditor
  const [body, setBody] = useState(reply?.body ?? '')
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeBusy, setRemoveBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = body.trim()
    setMissing(trimmed === '')
    if (trimmed === '') return
    setBusy(true)
    try {
      await onSave(trimmed)
    } catch {
      // 글은 그대로 - 오류 토스트는 전역 핸들러가 띄운다
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className={styles.form}>
      <Field label={t.body} hint={t.bodyHint} error={missing ? t.empty : undefined} required>
        {(control) => (
          <Textarea
            {...control}
            rows={5}
            value={body}
            onChange={(event) => {
              setBody(event.target.value)
              setMissing(false)
            }}
          />
        )}
      </Field>
      <div className={styles.actions}>
        <Button type="submit" loading={busy} loadingLabel={labels.loading}>
          {t.save}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {labels.cancel}
          </Button>
        )}
        {reply && onRemove && (
          <Button variant="danger" onClick={() => setRemoving(true)} disabled={busy}>
            {t.remove}
          </Button>
        )}
      </div>
      {removing && onRemove && (
        <ConfirmDialog
          open
          title={t.removeConfirmTitle}
          description={t.removeConfirmBody}
          confirmLabel={t.remove}
          cancelLabel={labels.cancel}
          closeLabel={labels.close}
          loadingLabel={labels.loading}
          busy={removeBusy}
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            setRemoveBusy(true)
            try {
              await onRemove()
              setRemoving(false)
            } catch {
              // 창은 그대로
            } finally {
              setRemoveBusy(false)
            }
          }}
        />
      )}
    </form>
  )
}
