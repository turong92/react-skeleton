import { Alert, Button, Dialog, Field, Textarea } from '@skeleton/ui'
import { useId, useState, type FormEvent } from 'react'
import type { ReviewsAdminLabels } from './labels'
import styles from './AdminReviewQueue.module.css'

export type HideDialogProps = {
  labels: ReviewsAdminLabels
  /** 어느 리뷰인지 - 본문 앞부분 */
  summary: string
  busy: boolean
  /** 직전 시도의 오류 문장 */
  error: string | null
  onClose: () => void
  onSubmit: (reason: string) => void
}

/** 리뷰 숨기기 창 — 사유가 필수다(작성자에게 보인다). 비어 있거나 공백뿐이면 숨기기 단추가 꺼져 있다 */
export function HideDialog({ labels, summary, busy, error, onClose, onSubmit }: HideDialogProps) {
  const t = labels.hide
  const formId = useId()
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (trimmed) onSubmit(trimmed)
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={t.title}
      closeLabel={labels.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {labels.cancel}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="danger"
            disabled={trimmed === ''}
            loading={busy}
            loadingLabel={labels.loading}
          >
            {t.submit}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit}>
        <p>{summary}</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={t.reason} hint={t.reasonHint} required>
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
