import { Alert, Badge, Button, Field, Input, SectionCard } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { submitWithReauth } from '../reauth'
import { PasswordField } from './PasswordField'
import { ReauthNotices, type ReauthSupport } from './ReauthNotices'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'

export type EmailSectionProps = {
  email: string | null
  verified: boolean
  hasPassword: boolean
  /** 202 — 새 주소의 확인 링크를 열 때까지 바뀌지 않는다. 비밀번호 없는 계정은 `confirmationToken`(다시 인증 메일 링크) */
  onChangeEmail: (request: {
    newEmail: string
    currentPassword?: string
    confirmationToken?: string
  }) => Promise<unknown>
  /** 서버가 알려 주는 대기 중 변경(`me.pendingEmail` · `pendingEmailExpiresAt`) — 새로고침 뒤에도 같은 상태를 그린다 */
  pendingEmail?: string | null
  pendingEmailExpiresAt?: string | null
  formatDate?: (iso: string) => string
  /** 비밀번호 없는 계정의 다시 인증(메일 링크 왕복). 없으면 서버의 403 이 오류 줄로 보일 뿐이다 */
  reauth?: ReauthSupport
  labels?: Partial<AuthLabels>
}

const defaultFormat = (iso: string) => new Date(iso).toLocaleString()

/**
 * 이메일 절 — 바꿔 달라는 요청은 새 주소의 확인을 기다린다. 대기 상태는 서버(`me.pendingEmail`)가 말해 주므로 새로고침해도 남는다.
 * 비밀번호 없는 계정은 먼저 본인 확인 메일의 링크를 열어야 한다(`reauth`).
 */
export function EmailSection({
  email,
  verified,
  hasPassword,
  onChangeEmail,
  pendingEmail,
  pendingEmailExpiresAt,
  formatDate = defaultFormat,
  reauth,
  labels: given,
}: EmailSectionProps) {
  const labels = mergeLabels(given)
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [requested, setRequested] = useState(false)
  const [mailSent, setMailSent] = useState(false)
  const action = useAction(labels)
  const resend = useAction(labels)
  const reauthActive = !hasPassword && !!reauth

  async function submit(event: FormEvent) {
    event.preventDefault()
    setRequested(false)
    let finished = true
    const ok = await action.run(async () => {
      if (!hasPassword && reauth) {
        const result = await submitWithReauth({
          store: reauth.store,
          requestMail: reauth.requestMail,
          action: { kind: 'email-change', newEmail },
          run: (credential) => onChangeEmail({ newEmail, ...credential }),
        })
        finished = result.status === 'done'
        setMailSent(!finished)
        setRequested(finished)
        return
      }
      await onChangeEmail({ newEmail, ...(hasPassword ? { currentPassword: password } : {}) })
      setRequested(true)
    })
    // 확인 메일을 기다리는 동안은 입력을 남겨 둔다(링크를 연 뒤 한 번 더 제출한다)
    if (ok && finished) {
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
        {pendingEmail && (
          <Alert tone="info" title={labels.emailPendingTitle}>
            {labels.emailPendingBody(
              pendingEmail,
              pendingEmailExpiresAt ? formatDate(pendingEmailExpiresAt) : undefined,
            )}
          </Alert>
        )}
        {requested && <Alert tone="success">{labels.emailRequested}</Alert>}
        <ReauthNotices
          active={reauthActive}
          sent={mailSent}
          ready={reauthActive && reauth.store.hasToken()}
          email={email}
          resending={resend.busy}
          onResend={() => void resend.run(() => reauth!.requestMail())}
          labels={labels}
        />
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
