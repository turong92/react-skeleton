import { Alert, Button, Dialog, Field, Input } from '@skeleton/ui'
import { useId, useState, type FormEvent } from 'react'
import { authErrorMessage } from '../screens/errors'
import type { AuthLabels } from '../screens/labels'
import styles from '../screens/auth.module.css'

/**
 * 운영자가 대상 계정의 2단계 인증을 해제한다 - 사유는 필수 입력이다(서버는 사유를 저장하지 않고 대상 id 만 기록한다).
 * 서버가 거절하면(자기 자신 · 권한 상승 · 이미 꺼짐) 창을 닫지 않고 그 이유를 창 안에서 말한다
 */
export function MfaResetDialog({
  email,
  labels,
  onReset,
  onClose,
}: {
  /** 대상 계정을 알아볼 이름(이메일 → 아이디 → id) */
  email: string
  labels: AuthLabels
  onReset: (reason: string) => Promise<unknown>
  onClose: () => void
}) {
  const formId = useId()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = reason.trim()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await onReset(trimmed)
    } catch (caught) {
      setError(authErrorMessage(caught, labels).message)
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={labels.adminMfaResetTitle(email)}
      closeLabel={labels.dialogClose}
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
            loadingLabel={labels.submitting}
          >
            {labels.adminMfaResetConfirm}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.stack} onSubmit={submit} noValidate>
        <p>{labels.adminMfaResetBody}</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={labels.adminMfaResetReason} hint={labels.adminMfaResetReasonHint} required>
          {(control) => (
            <Input
              {...control}
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
