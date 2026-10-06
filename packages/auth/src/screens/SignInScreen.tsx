import { Alert, Button, Field, Input } from '@skeleton/ui'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import { CheckEmailPanel } from './CheckEmailPanel'
import { PasswordField } from './PasswordField'
import { SocialButtons } from './SocialButtons'
import styles from './auth.module.css'
import { authErrorMessage, type AuthErrorInfo } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { resolveMethods, type SignInMethodsConfig } from './methods'
import { useCountdown } from './useCountdown'

export type SignInScreenProps = {
  /** 켜 둔 로그인 방법 — 기본은 이메일 + 비밀번호만 */
  methods?: SignInMethodsConfig
  labels?: Partial<AuthLabels>
  /** 이메일 + 비밀번호. 실패는 던진다(화면이 문구로 바꾼다) — 성공 뒤 이동은 호출자가 */
  onPasswordSignIn?: (credentials: { email: string; password: string }) => Promise<void>
  /** 이메일 링크 요청(항상 성공처럼 보인다 — 서버가 존재 여부를 숨긴다) */
  onMagicLinkRequest?: (email: string) => Promise<void>
  /** 소셜 제공자로 보낸다(보통 `window.location.assign(flow.start(provider))`) */
  onSocialSignIn?: (provider: string) => void
  signUpTo?: string
  forgotPasswordTo?: string
  /** 폼 위 안내(세션이 끝난 이유 …) */
  notice?: string
  /** 안내 옆 동작(방법을 못 불러왔을 때 「다시 시도」) */
  noticeAction?: ReactNode
  /** 처음 채워 둘 이메일(체험 계정 · 로그아웃 직후) */
  initialEmail?: string
}

/** 로그인 화면 — 방법(비밀번호 · 링크 · 소셜)은 `methods` 가 정한다. 코드 분기(`AUTH.*`)는 `errors.ts` 한 곳 */
export function SignInScreen({
  methods,
  labels: given,
  onPasswordSignIn,
  onMagicLinkRequest,
  onSocialSignIn,
  signUpTo,
  forgotPasswordTo,
  notice,
  noticeAction,
  initialEmail = '',
}: SignInScreenProps) {
  const labels = mergeLabels(given)
  const enabled = resolveMethods(methods)
  const hasPassword = enabled.password && !!onPasswordSignIn
  const hasMagic = enabled.magicLink && !!onMagicLinkRequest
  const [mode, setMode] = useState<'password' | 'magic'>(hasPassword ? 'password' : 'magic')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<AuthErrorInfo | null>(null)
  const [magicSentTo, setMagicSentTo] = useState<string | null>(null)
  const wait = useCountdown()

  function fail(error: unknown) {
    const info = authErrorMessage(error, labels)
    setFailure(info)
    if (info.retryAfterSeconds) wait.start(info.retryAfterSeconds)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure(null)
    try {
      if (mode === 'magic' && onMagicLinkRequest) {
        await onMagicLinkRequest(email)
        setMagicSentTo(email)
      } else if (onPasswordSignIn) {
        await onPasswordSignIn({ email, password })
      }
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  if (magicSentTo && onMagicLinkRequest) {
    return (
      <AuthLayout title={labels.signInTitle}>
        <CheckEmailPanel
          email={magicSentTo}
          labels={given}
          title={labels.magicLinkSentTitle}
          onResend={() => onMagicLinkRequest(magicSentTo)}
          onStartOver={() => setMagicSentTo(null)}
        />
      </AuthLayout>
    )
  }

  const throttled = wait.seconds > 0
  const message = failure?.message
  const showSocial = enabled.social.length > 0 && !!onSocialSignIn
  const otherMethodAbove = hasPassword || hasMagic

  return (
    <AuthLayout
      title={labels.signInTitle}
      subtitle={labels.signInSubtitle}
      footer={
        signUpTo ? (
          <>
            <span>{labels.signInNoAccount}</span>
            <Link className={styles.link} to={signUpTo}>
              {labels.signInCreateAccount}
            </Link>
          </>
        ) : undefined
      }
    >
      <div className={styles.stack}>
        {notice && (
          <Alert tone="info" action={noticeAction}>
            {notice}
          </Alert>
        )}
        {(hasPassword || hasMagic) && (
          <form className={styles.form} onSubmit={submit} aria-label={labels.signInTitle}>
            {failure && (
              <Alert tone="danger">
                {message}
                {failure.reference && ` (${labels.errorReference(failure.reference)})`}
              </Alert>
            )}
            <Field label={labels.email} required>
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
            </Field>
            {mode === 'password' && (
              <PasswordField
                label={labels.password}
                labels={labels}
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
              />
            )}
            {mode === 'magic' && <p className={styles.muted}>{labels.signInMagicLinkHelp}</p>}
            <Button
              type="submit"
              loading={busy}
              loadingLabel={labels.submitting}
              disabled={throttled}
            >
              {throttled
                ? labels.errorRetryIn(wait.seconds)
                : mode === 'magic'
                  ? labels.signInMagicLinkSubmit
                  : labels.signInSubmit}
            </Button>
            <div className={[styles.row, styles.between].join(' ')}>
              {mode === 'password' && forgotPasswordTo && (
                <Link className={styles.link} to={forgotPasswordTo}>
                  {labels.signInForgot}
                </Link>
              )}
              {hasPassword && hasMagic && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMode(mode === 'password' ? 'magic' : 'password')
                    setFailure(null)
                  }}
                >
                  {mode === 'password' ? labels.signInMagicLink : labels.signInUsePassword}
                </Button>
              )}
            </div>
          </form>
        )}
        {showSocial && otherMethodAbove && <div className={styles.divider}>{labels.or}</div>}
        {showSocial && (
          <SocialButtons
            providers={enabled.social}
            labels={labels}
            onSelect={(provider) => onSocialSignIn?.(provider)}
          />
        )}
      </div>
    </AuthLayout>
  )
}
