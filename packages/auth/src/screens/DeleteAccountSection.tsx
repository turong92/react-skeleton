import { Alert, Button, ConfirmDialog, Field, Input, SectionCard } from '@skeleton/ui'
import { useState } from 'react'
import type { DeletionResult } from '../account/types'
import { PasswordField } from './PasswordField'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'

export type DeleteAccountSectionProps = {
  hasPassword: boolean
  /** 서버의 유예 기간(`skeleton.account.deletion.grace`, 기본 30일) — 안내 문장에만 쓴다 */
  graceDays: number
  /** 비밀번호가 없는 계정: 확인 메일 요청 */
  onRequestConfirmation: () => Promise<unknown>
  onDelete: (credential: {
    currentPassword?: string
    confirmationToken?: string
  }) => Promise<DeletionResult>
  /** 확인 메일 링크(`/confirm-delete?token=`)로 들어왔을 때 미리 채우는 토큰 */
  confirmationToken?: string
  /** 삭제가 예약되고 나서(보통 이 기기를 로그아웃하고 안내 화면으로) */
  onDeleted?: (result: DeletionResult) => void
  formatDate?: (iso: string) => string
  labels?: Partial<AuthLabels>
}

const defaultFormat = (iso: string) => new Date(iso).toLocaleDateString()

/** 계정 삭제 절 — 다시 인증(비밀번호 또는 메일 토큰) → 글자를 정확히 쳐야 켜지는 확인 → 유예 기간 안내 */
export function DeleteAccountSection({
  hasPassword,
  graceDays,
  onRequestConfirmation,
  onDelete,
  confirmationToken = '',
  onDeleted,
  formatDate = defaultFormat,
  labels: given,
}: DeleteAccountSectionProps) {
  const labels = mergeLabels(given)
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(confirmationToken)
  const [mailSent, setMailSent] = useState(false)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<DeletionResult | null>(null)
  const mail = useAction(labels)
  const del = useAction(labels)
  const credential = hasPassword ? { currentPassword: password } : { confirmationToken: token }
  const ready = hasPassword ? password.length > 0 : token.length > 0

  async function confirm() {
    const ok = await del.run(async () => {
      const done = await onDelete(credential)
      setResult(done)
      onDeleted?.(done)
    })
    setOpen(false)
    if (!ok) return
  }

  if (result)
    return (
      <SectionCard id="delete" title={labels.sectionDelete}>
        <Alert tone="warning">{labels.deleteScheduled(formatDate(result.purgeAfter))}</Alert>
      </SectionCard>
    )

  return (
    <SectionCard
      id="delete"
      title={labels.sectionDelete}
      description={labels.deleteGraceNotice(graceDays)}
    >
      <div className={styles.stack}>
        {(del.error || mail.error) && (
          <Alert tone="danger">{(del.error ?? mail.error)?.message}</Alert>
        )}
        {hasPassword ? (
          <>
            <p className={styles.muted}>{labels.deletePasswordHint}</p>
            <PasswordField
              label={labels.currentPassword}
              labels={labels}
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
          </>
        ) : (
          <>
            <p className={styles.muted}>{labels.deleteMailHint}</p>
            <div>
              <Button
                variant="secondary"
                loading={mail.busy}
                loadingLabel={labels.submitting}
                onClick={async () => setMailSent(await mail.run(onRequestConfirmation))}
              >
                {labels.deleteMailSend}
              </Button>
            </div>
            {(mailSent || token) && (
              <>
                {mailSent && <Alert tone="success">{labels.deleteMailSent}</Alert>}
                <Field label={labels.deleteTokenLabel} required>
                  {(control) => (
                    <Input
                      {...control}
                      autoComplete="one-time-code"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                    />
                  )}
                </Field>
              </>
            )}
          </>
        )}
        <div>
          <Button variant="danger" disabled={!ready} onClick={() => setOpen(true)}>
            {labels.deleteButton}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        title={labels.deleteDialogTitle}
        description={labels.deleteDialogBody}
        confirmLabel={labels.deleteConfirm}
        cancelLabel={labels.cancel}
        closeLabel={labels.cancel}
        busy={del.busy}
        typedConfirmation={{ phrase: labels.deleteTypedPhrase, label: labels.deleteTypedLabel }}
      />
    </SectionCard>
  )
}
