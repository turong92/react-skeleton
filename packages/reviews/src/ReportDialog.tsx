import { Button, Dialog, Field, Textarea } from '@skeleton/ui'
import { useId, useState, type FormEvent } from 'react'
import type { ReviewsLabels } from './labels'
import { buildReportInput } from './reportInput'
import type { ReportInput, ReportReason } from './types'
import styles from './ReportDialog.module.css'

export type ReportDialogProps = {
  open: boolean
  onClose: () => void
  /** 보내는 일 — 약속이 풀리면 끝(창을 닫는 것은 부모), 던지면 창을 열어 둔다(오류 표시는 앱의 전역 핸들러) */
  onSubmit: (input: ReportInput) => Promise<unknown> | void
  /** 서버가 허용하는 사유(`config.reportReasons`) */
  reasons: ReportReason[]
  labels: Pick<ReviewsLabels, 'report' | 'item'>
}

/** 리뷰 신고 창 — 사유 하나(필수) + 자세한 내용(선택) */
export function ReportDialog({ open, onClose, onSubmit, reasons, labels }: ReportDialogProps) {
  const t = labels.report
  const name = useId()
  const formId = useId()
  const errorId = useId()
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [detail, setDetail] = useState('')
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = buildReportInput(reason, detail)
    setMissing(input === null)
    if (input === null) return
    setBusy(true)
    try {
      await onSubmit(input)
    } catch {
      // 창은 그대로 - 오류 토스트는 전역 핸들러가 띄운다
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.title}
      closeLabel={labels.item.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {labels.item.cancel}
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {t.submit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className={styles.form}>
        <fieldset className={styles.reasons} aria-describedby={missing ? errorId : undefined}>
          <legend className={styles.legend}>{t.reason}</legend>
          {reasons.map((value) => (
            <label key={value} className={styles.reason} data-checked={reason === value}>
              <input
                type="radio"
                name={name}
                value={value}
                checked={reason === value}
                onChange={() => {
                  setReason(value)
                  setMissing(false)
                }}
              />
              {t.reasons[value]}
            </label>
          ))}
          {missing && (
            <p id={errorId} role="alert" className={styles.error}>
              {t.reasonRequired}
            </p>
          )}
        </fieldset>
        <Field label={t.detail} hint={t.detailHint}>
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
