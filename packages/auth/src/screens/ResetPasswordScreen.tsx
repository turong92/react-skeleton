import { Alert, Button, FormProblems, useSubmitAttempt } from '@skeleton/ui'
import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { violationsOf } from '../account/passwordRules'
import type { PasswordPolicy, PasswordViolation } from '../account/types'
import { AuthLayout } from './AuthLayout'
import { NewPasswordFields } from './NewPasswordFields'
import { PasswordHints } from './PasswordHints'
import styles from './auth.module.css'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { usePasswordConfirm } from './passwordConfirm'
import { passwordProblems } from './passwordProblems'
import { ErrorCodes } from '@skeleton/api-client'

export type ResetPasswordScreenProps = {
  token: string | null
  policy?: PasswordPolicy
  onReset: (token: string, newPassword: string) => Promise<unknown>
  signInTo: string
  /** 새 링크를 요청하는 곳 */
  forgotTo: string
  labels?: Partial<AuthLabels>
  /** 비밀번호를 한 번 더 입력받는다(기본 false — 모듈은 중립이라 앱이 켠다) — 다르면 제출하지 않는다. 확인 값은 서버로 보내지 않는다 */
  confirmPassword?: boolean
}

/** `/reset-password?token=` — 성공하면 모든 세션이 끊기므로 로그인으로 보낸다(자동 로그인 없음) */
export function ResetPasswordScreen({
  token,
  policy,
  onReset,
  signInTo,
  forgotTo,
  labels: given,
  confirmPassword = false,
}: ResetPasswordScreenProps) {
  const labels = mergeLabels(given)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<'form' | 'done' | 'invalid'>(token ? 'form' : 'invalid')
  const [failure, setFailure] = useState<string | null>(null)
  const [violations, setViolations] = useState<PasswordViolation[]>([])
  const uid = useId()
  const ids = { password: `${uid}-password`, confirm: `${uid}-confirm` }
  const attempt = useSubmitAttempt()
  const confirm = usePasswordConfirm({
    enabled: confirmPassword,
    password,
    attempted: attempt.attempted,
    labels,
  })
  const check = passwordProblems({ labels, password, policy, confirm, ids })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setFailure(null)
    setViolations([])
    if (check.problems.length > 0) return attempt.fail(check.problems[0].target)
    setBusy(true)
    try {
      await onReset(token, password)
      confirm.reset()
      setPhase('done')
    } catch (error) {
      const server = violationsOf(error)
      if (server.length > 0) {
        setViolations(server)
        attempt.fail(ids.password)
      } else {
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
      <form className={styles.form} onSubmit={submit} aria-label={labels.resetTitle} noValidate>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <NewPasswordFields
          label={labels.newPassword}
          labels={labels}
          value={password}
          onChange={setPassword}
          confirm={confirm}
          ids={ids}
          error={attempt.attempted ? check.passwordError : undefined}
        />
        {policy && (
          <PasswordHints
            policy={policy}
            password={password}
            labels={labels}
            serverViolations={violations}
          />
        )}
        <FormProblems
          title={labels.formProblemsTitle}
          problems={attempt.attempted ? check.problems : []}
        />
        <Button type="submit" loading={busy} loadingLabel={labels.submitting}>
          {labels.resetSubmit}
        </Button>
      </form>
    </AuthLayout>
  )
}
