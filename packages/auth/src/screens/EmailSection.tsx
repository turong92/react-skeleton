import { Alert, Badge, Button, Field, Input, SectionCard } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { PasswordField } from './PasswordField'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'

export type EmailSectionProps = {
  email: string | null
  verified: boolean
  hasPassword: boolean
  /** 202 — 새 주소의 확인 링크를 열 때까지 바뀌지 않는다 */
  onChangeEmail: (request: { newEmail: string; currentPassword?: string }) => Promise<unknown>
  labels?: Partial<AuthLabels>
}

/**
 * 이메일 절 — 바꿔 달라는 요청은 「확인 대기」 상태가 된다. (서버의 `me` 에는 대기 중인 새 주소가 없어 이 상태는 화면이 요청한 동안만 기억한다)
 */
export function EmailSection({
  email,
  verified,
  hasPassword,
  onChangeEmail,
  labels: given,
}: EmailSectionProps) {
  const labels = mergeLabels(given)
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const action = useAction(labels)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const ok = await action.run(() =>
      onChangeEmail({ newEmail, ...(hasPassword ? { currentPassword: password } : {}) }),
    )
    if (ok) {
      setPending(newEmail)
      setNewEmail('')
      setPassword('')
    }
  }

  return (
    <SectionCard id="email" title={labels.sectionEmail}>
      <div className={styles.stack}>
        <div className={styles.row}>
          <span className={styles.muted}>{labels.emailCurrent}</span>
          <strong>{email}</strong>
          <Badge tone={verified ? 'success' : 'warning'}>
            {verified ? labels.emailVerified : labels.emailUnverified}
          </Badge>
        </div>
        {pending && (
          <Alert tone="info" title={labels.emailPendingTitle}>
            {labels.emailPendingBody(pending)}
          </Alert>
        )}
        <form className={styles.form} onSubmit={submit} aria-label={labels.emailChangeSubmit}>
          {action.error && <Alert tone="danger">{action.error.message}</Alert>}
          <Field label={labels.emailNew} required>
            {(control) => (
              <Input
                {...control}
                type="email"
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            )}
          </Field>
          {hasPassword && (
            <PasswordField
              label={labels.currentPassword}
              labels={labels}
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
          )}
          <div>
            <Button type="submit" loading={action.busy} loadingLabel={labels.submitting}>
              {labels.emailChangeSubmit}
            </Button>
          </div>
        </form>
      </div>
    </SectionCard>
  )
}
