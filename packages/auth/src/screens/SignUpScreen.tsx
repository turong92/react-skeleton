import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { Alert, Button, Checkbox, Field, Input } from '@skeleton/ui'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { passwordRequirements, violationsOf } from '../account/passwordRules'
import type {
  PasswordPolicy,
  PasswordViolation,
  SignUpRequest,
  SignUpStatus,
} from '../account/types'
import { AuthLayout } from './AuthLayout'
import { CheckEmailPanel } from './CheckEmailPanel'
import { PasswordField } from './PasswordField'
import { PasswordHints } from './PasswordHints'
import { SocialButtons } from './SocialButtons'
import styles from './auth.module.css'
import { authErrorMessage, type AuthErrorInfo } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { resolveMethods, type SignInMethodsConfig } from './methods'
import { useCountdown } from './useCountdown'

/** 동의 항목 하나 — 약관 · 방침의 판(version)을 함께 넘긴다. 백엔드 동의 모듈은 아직 없어 화면은 체크한 판을 콜백으로 보고만 한다 */
export type ConsentItem = {
  id: string
  version: string
  label: ReactNode
  required?: boolean
}
export type AcceptedConsent = { id: string; version: string }

export type CaptchaSlotApi = {
  /** 캡차가 토큰을 받으면(없애면 null) */
  onToken: (token: string | null) => void
}

export type SignUpSubmit = Omit<SignUpRequest, 'captchaToken'> & {
  captchaToken?: string
  /** 체크한 동의 항목과 그 판 */
  consents: AcceptedConsent[]
}

export type SignUpScreenProps = {
  /** `GET /account/password/policy` 의 값(앱이 불러 넘긴다 — 불러오는 중에는 undefined 로 두면 규칙 목록을 숨긴다) */
  policy?: PasswordPolicy
  labels?: Partial<AuthLabels>
  onSignUp: (request: SignUpSubmit) => Promise<{ status: SignUpStatus }>
  /** 메일 인증 상태(`VERIFICATION_SENT`)의 「다시 보내기」 */
  onResendVerification?: (email: string) => Promise<void>
  /** 메일 인증이 꺼진 앱(`CREATED`) — 바로 쓸 수 있는 계정 */
  onCreated?: () => void
  /** 소셜 가입(소셜 로그인과 같은 흐름) */
  methods?: SignInMethodsConfig
  onSocialSignIn?: (provider: string) => void
  /** 캡차 자리 — 위젯을 그리고 토큰을 `onToken` 으로 올린다(Turnstile 같은 캡차 위젯) */
  renderCaptcha?: (api: CaptchaSlotApi) => ReactNode
  /** 약관 · 방침 동의 자리 — 체크한 판을 `onSignUp` 의 `consents` 와 `onConsentsChange` 로 보고한다 */
  consents?: ConsentItem[]
  onConsentsChange?: (accepted: AcceptedConsent[]) => void
  /** 표시 이름을 묻는다(기본 안 묻는다 — 가입은 짧을수록 좋다) */
  askDisplayName?: boolean
  signInTo?: string
  /** 가입 요청에 실어 보낼 로케일 · 시간대 */
  locale?: string
  timeZone?: string
}

/** 가입 화면 — 비밀번호 규칙은 서버 정책에서 읽는다. 응답은 늘 「메일을 확인하세요」(주소가 있든 없든 같다) */
export function SignUpScreen({
  policy,
  labels: given,
  onSignUp,
  onResendVerification,
  onCreated,
  methods,
  onSocialSignIn,
  renderCaptcha,
  consents = [],
  onConsentsChange,
  askDisplayName = false,
  signInTo,
  locale,
  timeZone,
}: SignUpScreenProps) {
  const labels = mergeLabels(given)
  const enabled = resolveMethods(methods)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [consentError, setConsentError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<AuthErrorInfo | null>(null)
  const [serverViolations, setServerViolations] = useState<PasswordViolation[]>([])
  const [emailError, setEmailError] = useState<string | undefined>()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const wait = useCountdown()

  function toggleConsent(item: ConsentItem, value: boolean) {
    const next = { ...checked, [item.id]: value }
    setChecked(next)
    setConsentError(false)
    onConsentsChange?.(
      consents.filter((c) => next[c.id]).map(({ id, version }) => ({ id, version })),
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFailure(null)
    setEmailError(undefined)
    setServerViolations([])
    if (consents.some((c) => c.required && !checked[c.id])) {
      setConsentError(true)
      return
    }
    if (policy && passwordRequirements(policy, password, email).some((r) => !r.met)) {
      return // 체크리스트가 이미 어느 규칙이 부족한지 보여 준다
    }
    setBusy(true)
    try {
      const accepted = consents
        .filter((c) => checked[c.id])
        .map(({ id, version }) => ({ id, version }))
      const result = await onSignUp({
        email,
        password,
        ...(askDisplayName && displayName ? { displayName } : {}),
        ...(locale ? { locale } : {}),
        ...(timeZone ? { timeZone } : {}),
        ...(captchaToken ? { captchaToken } : {}),
        consents: accepted,
      })
      if (result.status === 'VERIFICATION_SENT') {
        setPassword('') // 메일 확인 화면에 남아 「주소가 틀렸어요」로 돌아와도 비밀번호는 다시 받는다
        setSentTo(email)
      } else onCreated?.()
    } catch (error) {
      const violations = violationsOf(error)
      if (violations.length > 0) setServerViolations(violations)
      else {
        const info = authErrorMessage(error, labels)
        if (
          error instanceof ApiRequestError &&
          error.apiError.code === ErrorCodes.COMMON_VALIDATION_FAILED
        ) {
          const emailField = error.apiError.errors?.find((e) => e.field === 'email')
          if (emailField) setEmailError(emailField.message ?? labels.errorValidation)
        }
        if (info.code === ErrorCodes.ACCOUNT_EMAIL_TAKEN) setEmailError(info.message)
        else setFailure(info)
        if (info.retryAfterSeconds) wait.start(info.retryAfterSeconds)
      }
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <AuthLayout title={labels.signUpTitle}>
        <CheckEmailPanel
          email={sentTo}
          labels={given}
          onResend={onResendVerification ? () => onResendVerification(sentTo) : undefined}
          onStartOver={() => setSentTo(null)}
        />
      </AuthLayout>
    )
  }

  const showSocial = enabled.social.length > 0 && !!onSocialSignIn
  const closed = failure?.code === ErrorCodes.ACCOUNT_SIGN_UP_CLOSED
  return (
    <AuthLayout
      title={closed ? labels.signUpClosedTitle : labels.signUpTitle}
      subtitle={closed ? undefined : labels.signUpSubtitle}
      footer={
        signInTo ? (
          <>
            <span>{labels.signUpHaveAccount}</span>
            <Link className={styles.link} to={signInTo}>
              {labels.signUpSignIn}
            </Link>
          </>
        ) : undefined
      }
    >
      <div className={styles.stack}>
        {showSocial && (
          <>
            <SocialButtons
              providers={enabled.social}
              labels={labels}
              onSelect={(p) => onSocialSignIn?.(p)}
            />
            <div className={styles.divider}>{labels.or}</div>
          </>
        )}
        <form className={styles.form} onSubmit={submit} aria-label={labels.signUpTitle}>
          {failure && <Alert tone="danger">{failure.message}</Alert>}
          <Field label={labels.email} required error={emailError}>
            {(control) => (
              <Input
                {...control}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>
          {askDisplayName && (
            <Field label={labels.displayName}>
              {(control) => (
                <Input
                  {...control}
                  autoComplete="name"
                  maxLength={60}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              )}
            </Field>
          )}
          <PasswordField
            label={labels.password}
            labels={labels}
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
          />
          {policy && (
            <PasswordHints
              policy={policy}
              password={password}
              email={email}
              labels={labels}
              serverViolations={serverViolations}
            />
          )}
          {renderCaptcha && (
            <div className={styles.stack} aria-label={labels.signUpCaptcha}>
              {renderCaptcha({ onToken: setCaptchaToken })}
            </div>
          )}
          {consents.length > 0 && (
            <div className={styles.stack}>
              {consents.map((item) => (
                <Checkbox
                  key={item.id}
                  label={
                    <>
                      {item.label}
                      {item.required && (
                        <span className={styles.muted}> ({labels.signUpConsentRequired})</span>
                      )}
                    </>
                  }
                  checked={!!checked[item.id]}
                  onChange={(event) => toggleConsent(item, event.target.checked)}
                  error={
                    consentError && item.required && !checked[item.id]
                      ? labels.signUpConsentRequired
                      : undefined
                  }
                />
              ))}
            </div>
          )}
          <Button
            type="submit"
            loading={busy}
            loadingLabel={labels.submitting}
            disabled={wait.seconds > 0}
          >
            {wait.seconds > 0 ? labels.errorRetryIn(wait.seconds) : labels.signUpSubmit}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
