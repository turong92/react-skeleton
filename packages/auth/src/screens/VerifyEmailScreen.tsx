import { Alert, Button, Field, Input } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { TokenLanding } from './TokenLanding'
import styles from './auth.module.css'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'

export type VerifyEmailScreenProps = {
  token: string | null
  onVerify: (token: string) => Promise<unknown>
  /** 안 되는 링크(만료 · 이미 씀)에서 새 링크를 받는다 */
  onResend?: (email: string) => Promise<unknown>
  signInTo: string
  labels?: Partial<AuthLabels>
}

/** `/verify-email` — 성공 · 만료 · 이미 씀(서버는 한 응답이라 구분하지 않는다) + 다시 받기 */
export function VerifyEmailScreen({
  token,
  onVerify,
  onResend,
  signInTo,
  labels: given,
}: VerifyEmailScreenProps) {
  const labels = mergeLabels(given)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resend(event: FormEvent) {
    event.preventDefault()
    if (!onResend) return
    setBusy(true)
    setError(null)
    try {
      await onResend(email)
      setSent(true)
    } catch (caught) {
      setError(authErrorMessage(caught, labels).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <TokenLanding
      token={token}
      run={onVerify}
      labels={given}
      title={labels.verifyEmailTitle}
      checking={labels.verifyEmailChecking}
      done={
        <>
          <Alert tone="success">{labels.verifyEmailDone}</Alert>
          <Link className={styles.link} to={signInTo}>
            {labels.verifyEmailDoneAction}
          </Link>
        </>
      }
      invalidTitle={labels.verifyEmailInvalidTitle}
      invalidBody={labels.verifyEmailInvalidBody}
      invalid={
        onResend && (
          <form
            className={styles.form}
            onSubmit={resend}
            aria-label={labels.verifyEmailResendSubmit}
          >
            {error && <Alert tone="danger">{error}</Alert>}
            {sent && <Alert tone="success">{labels.signInVerificationResent}</Alert>}
            <Field label={labels.email} required>
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" loading={busy} loadingLabel={labels.submitting}>
              {labels.verifyEmailResendSubmit}
            </Button>
          </form>
        )
      }
    />
  )
}
