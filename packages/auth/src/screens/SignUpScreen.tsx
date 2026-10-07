import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import {
  Alert,
  Button,
  Checkbox,
  Field,
  FormProblems,
  Input,
  useSubmitAttempt,
  type FormProblem,
} from '@skeleton/ui'
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { violationsOf } from '../account/passwordRules'
import { useCodeClock } from '../codeClockContext'
import { codeWindowOf, estimateCodeWindow } from '../codeWindow'
import type { PendingSignUp } from '../signUpPending'
import type {
  PasswordPolicy,
  PasswordViolation,
  SignUpRequest,
  SignUpStatus,
} from '../account/types'
import { AuthLayout } from './AuthLayout'
import { VerifyCodePanel } from './VerifyCodePanel'
import { NewPasswordFields } from './NewPasswordFields'
import { PasswordHints } from './PasswordHints'
import { SocialButtons } from './SocialButtons'
import styles from './auth.module.css'
import { authErrorMessage, type AuthErrorInfo } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { resolveMethods, type SignInMethodsConfig } from './methods'
import { usePasswordConfirm } from './passwordConfirm'
import { passwordProblems } from './passwordProblems'
import { useCountdown } from './useCountdown'

/** 동의 항목 하나 — 약관 · 방침의 판(version)을 함께 넘긴다. 백엔드 동의 모듈은 아직 없어 화면은 체크한 판을 콜백으로 보고만 한다 */
export type ConsentItem = {
  id: string
  version: string
  label: ReactNode
  required?: boolean
}
export type AcceptedConsent = { id: string; version: string; locale?: string }

/** 동의 자리를 통째로 맡길 때(`renderConsents`) 화면이 슬롯에 주는 것 — `@skeleton/legal` 의 `SignUpConsents` 가 받는다 */
export type ConsentSlotApi = {
  /** 체크가 바뀔 때마다 — 체크한 항목과 「필수가 모두 체크됐는가」 */
  onChange: (accepted: AcceptedConsent[], complete: boolean) => void
  /** 필수를 안 채우고 제출을 시도했다 */
  showError: boolean
  /** 서버가 `LEGAL.CONSENT_REQUIRED`(그 사이 약관이 바뀜)로 거절할 때마다 올라간다 — 슬롯은 문서를 다시 읽는다 */
  refreshKey: number
}

export type CaptchaSlotApi = {
  /** 캡차가 토큰을 받으면(없애면 null) */
  onToken: (token: string | null) => void
}

export type SignUpSubmit = Omit<SignUpRequest, 'captchaToken' | 'consents'> & {
  captchaToken?: string
  /** 체크한 동의 항목과 그 판 */
  consents: AcceptedConsent[]
}

export type SignUpScreenProps = {
  /** `GET /account/password/policy` 의 값(앱이 불러 넘긴다 — 불러오는 중에는 undefined 로 두면 규칙 목록을 숨긴다) */
  policy?: PasswordPolicy
  labels?: Partial<AuthLabels>
  onSignUp: (request: SignUpSubmit) => Promise<{
    status: SignUpStatus
    signUpId?: string
    /** 서버가 주면(오늘은 안 준다) 그 값이 이긴다 — 없으면 `codeTtlSeconds` 로 어림 */
    expiresAt?: string | number
    resendAvailableAt?: string | number
  }>
  /** 가입 응답에 `signUpId` 가 오면 같은 화면에서 6자리 인증번호를 받는다. 이 함수가 코드를 서버에 내고(성공하면 가입이 끝나고 바로 로그인) 그 뒤의 이동은 호출자가 한다 */
  onVerifyCode: (signUpId: string, code: string) => Promise<unknown>
  /** 코드 단계의 「새 코드 받기」(같은 시도에 새 코드) */
  onResendCode?: (signUpId: string) => Promise<unknown>
  /** 새로고침해도 코드 단계가 이어지도록 앱이 보관해 둔 진행 중 가입(탭 하나의 sessionStorage 등) */
  initialPending?: PendingSignUp
  /** 코드 단계에 들어가거나(값) 벗어나면(null) — 앱이 보관한다 */
  onPendingChange?: (pending: PendingSignUp | null) => void
  /** 서버가 만료 시각을 안 줄 때 어림하는 코드 유효 시간(초, 백엔드 `verification.code-ttl` 기본 10분) */
  codeTtlSeconds?: number
  /** 다시 받기 쿨다운(초, 백엔드 기본 30) */
  resendCooldownSeconds?: number
  /** 메일 인증이 꺼진 앱(`CREATED`) — 바로 쓸 수 있는 계정 */
  onCreated?: () => void
  /** 소셜 가입(소셜 로그인과 같은 흐름) */
  methods?: SignInMethodsConfig
  onSocialSignIn?: (provider: string) => void
  /** 캡차 자리 — 위젯을 그리고 토큰을 `onToken` 으로 올린다(Turnstile 같은 캡차 위젯) */
  renderCaptcha?: (api: CaptchaSlotApi) => ReactNode
  /** 약관 · 방침 동의 자리 — 체크한 판을 `onSignUp` 의 `consents` 와 `onConsentsChange` 로 보고한다 */
  consents?: ConsentItem[]
  /** 동의 자리를 통째로 슬롯에 맡긴다(서버가 문서를 쥘 때) — 있으면 `consents` 대신 쓰이고, 슬롯이 「완료」를 알리기 전에는 제출하지 않는다 */
  renderConsents?: (api: ConsentSlotApi) => ReactNode
  onConsentsChange?: (accepted: AcceptedConsent[]) => void
  /** 표시 이름을 묻는다(기본 안 묻는다 — 가입은 짧을수록 좋다) */
  askDisplayName?: boolean
  /** 비밀번호를 한 번 더 입력받는다(기본 true) — 다르면 제출하지 않는다. 확인 값은 서버로 보내지 않는다 */
  confirmPassword?: boolean
  signInTo?: string
  /** 가입 요청에 실어 보낼 로케일 · 시간대 */
  locale?: string
  timeZone?: string
}

/** 가입 화면 — 비밀번호 규칙은 서버 정책에서 읽는다. 응답은 늘 같은 모양이라(주소가 있든 없든) 메일로 받은 6자리 인증번호를 같은 화면에서 입력하고, 맞으면 바로 로그인한다 */
export function SignUpScreen({
  policy,
  labels: given,
  onSignUp,
  onVerifyCode,
  onResendCode,
  initialPending,
  onPendingChange,
  codeTtlSeconds = 600,
  resendCooldownSeconds = 30,
  onCreated,
  methods,
  onSocialSignIn,
  renderCaptcha,
  consents = [],
  renderConsents,
  onConsentsChange,
  askDisplayName = false,
  confirmPassword = true,
  signInTo,
  locale,
  timeZone,
}: SignUpScreenProps) {
  const labels = mergeLabels(given)
  const now = useCodeClock()
  const enabled = resolveMethods(methods)
  const [email, setEmail] = useState(initialPending?.email ?? '') // 새로고침 뒤 「처음부터」로 돌아와도 주소는 남는다
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [slotAccepted, setSlotAccepted] = useState<AcceptedConsent[]>([])
  const [slotComplete, setSlotComplete] = useState(!renderConsents)
  const [consentRefresh, setConsentRefresh] = useState(0)
  const uid = useId()
  const ids = {
    email: `${uid}-email`,
    password: `${uid}-password`,
    confirm: `${uid}-confirm`,
    consents: `${uid}-consents`,
  }
  const attempt = useSubmitAttempt()
  const confirm = usePasswordConfirm({
    enabled: confirmPassword,
    password,
    attempted: attempt.attempted,
    labels,
  })
  const consentsMissing = renderConsents
    ? !slotComplete
    : consents.some((c) => c.required && !checked[c.id])
  // 제출을 시도한 뒤에는 이 값이 곧바로 따라 바뀐다 — 모자란 동의를 체크하면 오류가 바로 사라진다
  const consentError = attempt.attempted && consentsMissing
  const slotApi = useMemo<ConsentSlotApi>(
    () => ({
      onChange: (accepted, complete) => {
        setSlotAccepted(accepted)
        setSlotComplete(complete)
      },
      showError: consentError,
      refreshKey: consentRefresh,
    }),
    [consentError, consentRefresh],
  )
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<AuthErrorInfo | null>(null)
  const [serverViolations, setServerViolations] = useState<PasswordViolation[]>([])
  const [emailError, setEmailError] = useState<string | undefined>()
  const [pending, setPending] = useState(initialPending ?? null)
  const wait = useCountdown()

  function toggleConsent(item: ConsentItem, value: boolean) {
    const next = { ...checked, [item.id]: value }
    setChecked(next)
    onConsentsChange?.(
      consents.filter((c) => next[c.id]).map(({ id, version }) => ({ id, version })),
    )
  }

  const emailProblem = !email.trim()
    ? labels.problemEmailMissing
    : !/^[^\s@]+@[^\s@]+$/.test(email.trim())
      ? labels.problemEmailInvalid
      : undefined
  const passwordCheck = passwordProblems({ labels, password, email, policy, confirm, ids })
  const passwordProblem = passwordCheck.passwordError
  const problems: FormProblem[] = [
    ...(emailProblem ? [{ key: 'email', message: emailProblem, target: ids.email }] : []),
    ...passwordCheck.problems.filter((p) => p.key === 'password'),
    ...serverViolations.map((code) => ({
      key: `violation-${code}`,
      message: labels.passwordRule[code],
      target: ids.password,
    })),
    ...passwordCheck.problems.filter((p) => p.key === 'confirm'),
    ...(consentsMissing
      ? [{ key: 'consents', message: labels.problemConsentMissing, target: ids.consents }]
      : []),
  ]
  const shownProblems = attempt.attempted ? problems : []

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFailure(null)
    setEmailError(undefined)
    setServerViolations([])
    // 막힌 이유는 버튼 위 요약 + 칸 옆 오류로 보이고, 첫 틀린 칸으로 포커스가 간다. 버튼은 늘 눌린다(꺼진 버튼은 이유를 말하지 못한다)
    const blocking = problems.filter((p) => !p.key.startsWith('violation-'))
    if (blocking.length > 0) return attempt.fail(blocking[0].target)
    setBusy(true)
    try {
      const accepted = renderConsents
        ? slotAccepted
        : consents.filter((c) => checked[c.id]).map(({ id, version }) => ({ id, version }))
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
        confirm.reset()
        attempt.reset()
        // 메일 인증이 켜져 있으면 늘 signUpId 가 온다(주소가 새것이든 이미 있든 같은 모양) — 코드 입력 단계로
        if (result.signUpId) {
          // 만료 · 재요청 시각: 서버가 응답에 주면 그 값(오늘 백엔드는 안 준다), 아니면 문서화된 유효 시간으로 어림한다. 코드는 저장하지 않는다
          const sent =
            codeWindowOf(result) ??
            estimateCodeWindow(now(), {
              ttlSeconds: codeTtlSeconds,
              cooldownSeconds: resendCooldownSeconds,
            })
          const next: PendingSignUp = {
            email,
            signUpId: result.signUpId,
            expiresAt: sent.expiresAt,
            ...(sent.resendAvailableAt ? { resendAvailableAt: sent.resendAvailableAt } : {}),
            ...(sent.source === 'estimate' ? { estimated: true } : {}),
          }
          setPending(next)
          onPendingChange?.(next)
        }
      } else onCreated?.()
    } catch (error) {
      const violations = violationsOf(error)
      if (violations.length > 0) {
        setServerViolations(violations)
        attempt.fail(ids.password)
      } else {
        const info = authErrorMessage(error, labels)
        if (
          error instanceof ApiRequestError &&
          error.apiError.code === ErrorCodes.COMMON_VALIDATION_FAILED
        ) {
          const emailField = error.apiError.errors?.find((e) => e.field === 'email')
          if (emailField) {
            setEmailError(emailField.message ?? labels.errorValidation)
            attempt.fail(ids.email)
          }
        }
        if (info.code === ErrorCodes.LEGAL_CONSENT_REQUIRED) setConsentRefresh((n) => n + 1)
        if (info.code === ErrorCodes.ACCOUNT_EMAIL_TAKEN) {
          setEmailError(info.message)
          attempt.fail(ids.email)
        } else setFailure(info)
        if (info.retryAfterSeconds) wait.start(info.retryAfterSeconds)
      }
    } finally {
      setBusy(false)
    }
  }

  if (pending) {
    const leave = () => {
      setPending(null)
      onPendingChange?.(null)
    }
    return (
      <AuthLayout title={labels.signUpTitle}>
        <VerifyCodePanel
          email={pending.email}
          labels={given}
          expiresAt={pending.expiresAt}
          expirySource={pending.estimated ? 'estimate' : 'server'}
          resendAvailableAt={pending.resendAvailableAt}
          codeTtlSeconds={codeTtlSeconds}
          resendCooldownSeconds={resendCooldownSeconds}
          expiredResend="restart" // 서버는 만료된 시도의 다시 받기를 조용히 무시한다 — 만료 뒤에는 처음부터
          onVerify={async (code) => {
            await onVerifyCode(pending.signUpId, code)
            onPendingChange?.(null)
          }}
          onResend={onResendCode ? () => onResendCode(pending.signUpId) : undefined}
          onStartOver={leave} // 이메일은 남고 비밀번호는 비워져 있다
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
        <form className={styles.form} onSubmit={submit} aria-label={labels.signUpTitle} noValidate>
          {failure && <Alert tone="danger">{failure.message}</Alert>}
          <Field
            id={ids.email}
            label={labels.email}
            required
            error={emailError ?? (attempt.attempted ? emailProblem : undefined)}
          >
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
          <NewPasswordFields
            label={labels.password}
            labels={labels}
            value={password}
            onChange={setPassword}
            confirm={confirm}
            ids={ids}
            error={attempt.attempted ? passwordProblem : undefined}
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
          {renderConsents && (
            <div id={ids.consents} className={styles.stack}>
              {renderConsents(slotApi)}
            </div>
          )}
          {!renderConsents && consents.length > 0 && (
            <div id={ids.consents} className={styles.stack}>
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
          <FormProblems title={labels.formProblemsTitle} problems={shownProblems} />
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
