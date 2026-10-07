import { Alert, Button, Field, FormProblems, Input, useSubmitAttempt } from '@skeleton/ui'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import { CheckEmailPanel } from './CheckEmailPanel'
import styles from './auth.module.css'
import { authErrorMessage, type AuthErrorInfo } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { useCountdown } from './useCountdown'

export type ForgotPasswordScreenProps = {
  onSubmit: (email: string) => Promise<unknown>
  signInTo: string
  labels?: Partial<AuthLabels>
  /** 캡차 자리 */
  renderCaptcha?: (api: { onToken: (token: string | null) => void }) => ReactNode
  onSubmitWithCaptcha?: (email: string, captchaToken?: string) => Promise<unknown>
}

/** 비밀번호 찾기 — 서버는 주소가 있든 없든 202 라 화면도 「있다면 보냈다」만 말한다 */
export function ForgotPasswordScreen({
  onSubmit,
  signInTo,
  labels: given,
  renderCaptcha,
  onSubmitWithCaptcha,
}: ForgotPasswordScreenProps) {
  const labels = mergeLabels(given)
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<AuthErrorInfo | null>(null)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const wait = useCountdown()
  const emailId = `${useId()}-email`
  const attempt = useSubmitAttempt()
  const emailProblem = !email.trim()
    ? labels.problemEmailMissing
    : !/^[^\s@]+@[^\s@]+$/.test(email.trim())
      ? labels.problemEmailInvalid
      : undefined

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (emailProblem) return attempt.fail(emailId)
    setBusy(true)
    setFailure(null)
    try {
      if (onSubmitWithCaptcha) await onSubmitWithCaptcha(email, captcha ?? undefined)
      else await onSubmit(email)
      setSentTo(email)
    } catch (error) {
      const info = authErrorMessage(error, labels)
      setFailure(info)
      if (info.retryAfterSeconds) wait.start(info.retryAfterSeconds)
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <Link className={styles.link} to={signInTo}>
      {labels.backToSignIn}
    </Link>
  )
  if (sentTo)
    return (
      <AuthLayout title={labels.forgotSentTitle} footer={back}>
        <CheckEmailPanel
          email={sentTo}
          labels={given}
          title={labels.forgotSentTitle}
          body={labels.forgotSentBody(sentTo)}
          onResend={async () => {
            await onSubmit(sentTo)
          }}
        />
      </AuthLayout>
    )
  return (
    <AuthLayout title={labels.forgotTitle} subtitle={labels.forgotSubtitle} footer={back}>
      <form className={styles.form} onSubmit={submit} aria-label={labels.forgotTitle} noValidate>
        {failure && <Alert tone="danger">{failure.message}</Alert>}
        <Field
          id={emailId}
          label={labels.email}
          required
          error={attempt.attempted ? emailProblem : undefined}
        >
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
        {renderCaptcha?.({ onToken: setCaptcha })}
        <FormProblems
          title={labels.formProblemsTitle}
          problems={
            attempt.attempted && emailProblem
              ? [{ key: 'email', message: emailProblem, target: emailId }]
              : []
          }
        />
        <Button
          type="submit"
          loading={busy}
          loadingLabel={labels.submitting}
          disabled={wait.seconds > 0}
        >
          {wait.seconds > 0 ? labels.errorRetryIn(wait.seconds) : labels.forgotSubmit}
        </Button>
      </form>
    </AuthLayout>
  )
}
