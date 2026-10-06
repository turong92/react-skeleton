import { Alert, Button } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { passwordRequirements, violationsOf } from '../account/passwordRules'
import type { PasswordPolicy, PasswordViolation } from '../account/types'
import { AuthLayout } from './AuthLayout'
import { PasswordField } from './PasswordField'
import { PasswordHints } from './PasswordHints'
import styles from './auth.module.css'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { ErrorCodes } from '@skeleton/api-client'

export type ResetPasswordScreenProps = {
  token: string | null
  policy?: PasswordPolicy
  onReset: (token: string, newPassword: string) => Promise<unknown>
  signInTo: string
  /** 새 링크를 요청하는 곳 */
  forgotTo: string
  labels?: Partial<AuthLabels>
}

/** `/reset-password?token=` — 성공하면 모든 세션이 끊기므로 로그인으로 보낸다(자동 로그인 없음) */
export function ResetPasswordScreen({
  token,
  policy,
  onReset,
  signInTo,
  forgotTo,
  labels: given,
}: ResetPasswordScreenProps) {
  const labels = mergeLabels(given)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<'form' | 'done' | 'invalid'>(token ? 'form' : 'invalid')
  const [failure, setFailure] = useState<string | null>(null)
  const [violations, setViolations] = useState<PasswordViolation[]>([])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setFailure(null)
    setViolations([])
    if (policy && passwordRequirements(policy, password).some((r) => !r.met)) return
    setBusy(true)
    try {
      await onReset(token, password)
      setPhase('done')
    } catch (error) {
      const server = violationsOf(error)
      if (server.length > 0) setViolations(server)
      else {
        const info = authErrorMessage(error, labels)
        if (info.code === ErrorCodes.ACCOUNT_TOKEN_INVALID) setPhase('invalid')
        else setFailure(info.message)
      }
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'invalid')
    return (
      <AuthLayout title={labels.resetInvalidTitle}>
        <div className={styles.stack}>
          <p>{labels.resetInvalidBody}</p>
          <Link className={styles.link} to={forgotTo}>
            {labels.resetRequestNew}
          </Link>
        </div>
      </AuthLayout>
    )
  if (phase === 'done')
    return (
      <AuthLayout title={labels.resetDoneTitle}>
        <div className={styles.stack}>
          <Alert tone="success">{labels.resetDoneBody}</Alert>
          <Link className={styles.link} to={signInTo}>
            {labels.backToSignIn}
          </Link>
        </div>
      </AuthLayout>
    )
  return (
    <AuthLayout title={labels.resetTitle} subtitle={labels.resetSubtitle}>
      <form className={styles.form} onSubmit={submit} aria-label={labels.resetTitle}>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <PasswordField
          label={labels.newPassword}
          labels={labels}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        {policy && (
          <PasswordHints
            policy={policy}
            password={password}
            labels={labels}
            serverViolations={violations}
          />
        )}
        <Button type="submit" loading={busy} loadingLabel={labels.submitting}>
          {labels.resetSubmit}
        </Button>
      </form>
    </AuthLayout>
  )
}
