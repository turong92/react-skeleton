import { isErrorCode, ErrorCodes } from '@skeleton/api-client'
import { Alert, Button, useSubmitAttempt } from '@skeleton/ui'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { CodeSent, SocialReauth } from '../account/accountApi'
import { useCodeClock } from '../codeClockContext'
import { codeWindowOf, estimateCodeWindow, type CodeWindow } from '../codeWindow'
import authStyles from './auth.module.css'
import styles from './EmailRequiredScreen.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { DiscardPath } from './DiscardPath'
import { AddressField, LeaveActions, ReauthPrompt } from './EmailRequiredParts'
import { labelOfMethod } from './methodsList'
import { useAction } from './useAction'
import { VerifyCodePanel } from './VerifyCodePanel'

export type EmailRequiredScreenProps = {
  /** 이 계정이 로그인에 쓰는 소셜 제공자 코드들 — 「번호가 안 오면」 안내와 1시간 뒤 재동의 단추에 쓴다 */
  providers?: string[]
  /** 서버가 알려 주는 대기 중 변경(`me.pendingEmail` · `pendingEmailExpiresAt`) — 새로고침 · 다시 들어와도 주소 입력으로 돌아가지 않고 인증번호 단계를 연다. 입력을 시작했거나 이미 보낸 뒤에는 건드리지 않는다 */
  pending?: { email: string; window: CodeWindow } | null
  /** `POST /account/email/change { newEmail }`(다시 인증 없이 · 마지막 로그인 1시간 안). 다시 보내기도 같은 호출이다 */
  onRequestCode: (request: { newEmail: string; socialReauth?: SocialReauth }) => Promise<CodeSent>
  /** `POST /account/email/change/confirm { code }` — 요청한 그 세션에서만 */
  onConfirmCode: (code: string) => Promise<unknown>
  /** 확인됐다 — 앱이 화면을 닫고 원래 가려던 곳으로 보낸다 */
  onRegistered: () => void
  /** 1시간이 지나 서버가 `REAUTH_REQUIRED` 를 말했다: 이 제공자의 동의 화면으로 보낸다(돌아오면 계정 설정에서 이어진다) */
  onProviderReauth?: (provider: string, newEmail: string) => void
  onSignOut: () => void
  /** 「이 계정 지우고 로그인 화면으로」 - `POST /account/discard`(허용 목록에 있어 막다른 길이 되지 않는다). 던진 `REAUTH_REQUIRED` 는 제공자 재동의 단추가 된다 */
  onDiscard: () => Promise<void>
  /** 지웠다 - 앱이 로컬 세션을 지우고 로그인 화면으로 보낸다. 인자는 로그인 뒤 연결을 이어 갈 제공자 */
  onDiscarded: (provider?: string) => void
  /** 오래된 세션이라 버리기도 제공자 재동의를 요구했다 - 그 제공자의 동의 화면으로(돌아오면 설정이 이어서 부른다) */
  onDiscardReauth?: (provider: string) => void
  labels?: Partial<AuthLabels>
}

const SHAPE = /^[^\s@]+@[^\s@]+$/

/**
 * 「이메일을 등록해 주세요」 — 이메일이 필수인 앱에서 주소가 없는 계정이 앱 대신 보는 전면 화면(`EmailRequiredGate` 가 덮는다).
 * 주소 → 6자리 인증번호(같은 `VerifyCodePanel`: 서버의 `expiresAt` · `resendAvailableAt` 로 센다) → 끝. 남이 쓰는 주소는 서버가 같은 202 를 주고 번호는 가지 않으므로
 * 번호 화면에 「안 오면」 안내가 늘 있다. 떠나는 길(로그아웃 · 계정 삭제)을 늘 둔다.
 */
export function EmailRequiredScreen({
  providers = [],
  pending,
  onRequestCode,
  onConfirmCode,
  onRegistered,
  onProviderReauth,
  onSignOut,
  onDiscard,
  onDiscarded,
  onDiscardReauth,
  labels: given,
}: EmailRequiredScreenProps) {
  const labels = mergeLabels(given)
  const uid = useId()
  const ids = { title: `${uid}-title`, email: `${uid}-email` }
  const now = useCodeClock()
  const action = useAction(labels)
  const attempt = useSubmitAttempt()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(pending?.email ?? null)
  const [codeWin, setWindow] = useState<CodeWindow | null>(pending?.window ?? null)
  /** 서버가 첫 등록에도 다시 인증을 요구했다(마지막 로그인 1시간 초과) */
  const [reauth, setReauth] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const card = useRef<HTMLDivElement>(null)

  // 화면이 뜨면 제목으로(낭독이 제목 · 설명부터), 이후 단계가 바뀔 때는 그 단계의 첫 칸으로. 이전 단계를 기억해 같은 단계에서 효과가 다시 돌아도(StrictMode) 포커스를 뺏지 않는다
  const seenStep = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (seenStep.current === sentTo) return
    const initial = seenStep.current === undefined
    seenStep.current = sentTo
    if (initial) heading.current?.focus()
    else if (sentTo === null) document.getElementById(ids.email)?.focus()
    // 눌렀던 「인증번호 받기」는 사라졌다 — 포커스를 인증번호 첫 칸으로(낭독이 다음 할 일에서 이어진다)
    else
      card.current?.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')?.focus()
  }, [sentTo, ids.email])

  // 서버가 대기 중 변경을 뒤늦게 알려 줬다(`me` 가 이 화면보다 늦게 읽혔다) - 아무것도 시작하지 않았으면 인증번호 단계로. 값이 바뀔 때 한 번만(렌더 중 상태 맞춤)
  const pendingKey = pending ? `${pending.email}@${pending.window.expiresAt}` : null
  const [appliedKey, setAppliedKey] = useState(pendingKey)
  if (pendingKey !== appliedKey) {
    setAppliedKey(pendingKey)
    if (pending && email === '' && sentTo === null) {
      setSentTo(pending.email)
      setWindow(pending.window)
    }
  }

  const problem = !email.trim()
    ? labels.problemEmailMissing
    : !SHAPE.test(email.trim())
      ? labels.problemEmailInvalid
      : undefined

  async function send(event?: FormEvent) {
    event?.preventDefault()
    if (problem) return attempt.fail(ids.email)
    let response: CodeSent
    const ok = await action.run(async () => {
      try {
        response = await onRequestCode({ newEmail: email.trim() })
      } catch (caught) {
        // 마지막 로그인이 1시간을 넘었다 — 이 칸 아래에서 제공자 재동의를 안내한다(오류 줄로 두지 않는다)
        if (isErrorCode(caught, ErrorCodes.ACCOUNT_REAUTH_REQUIRED)) setReauth(true)
        throw caught
      }
    })
    if (ok) {
      setReauth(false)
      setWindow(codeWindowOf(response!) ?? estimateCodeWindow(now(), { ttlSeconds: 600 }))
      setSentTo(email.trim())
      attempt.reset()
    }
  }

  const providerName = providers.length > 0 ? labelOfMethod(providers[0], labels) : null

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby={ids.title}>
      <div className={styles.card} ref={card}>
        <div>
          <h1 id={ids.title} ref={heading} tabIndex={-1}>
            {labels.emailRequiredTitle}
          </h1>
          <p className={styles.lead}>{labels.emailRequiredBody}</p>
        </div>
        {sentTo ? (
          <div className={authStyles.stack}>
            <VerifyCodePanel
              email={sentTo}
              title={labels.emailRequiredCodeTitle}
              description={labels.emailRequiredCodeBody(sentTo)}
              labels={{ ...given, checkEmailWrongAddress: labels.emailRequiredFixAddress }}
              expiresAt={codeWin?.expiresAt}
              expirySource={codeWin?.source ?? 'estimate'}
              resendAvailableAt={codeWin?.resendAvailableAt}
              resendExhausted={codeWin?.resendExhausted === true}
              onVerify={async (code) => {
                await onConfirmCode(code)
                onRegistered()
              }}
              onResend={() => onRequestCode({ newEmail: sentTo })}
              onStartOver={() => {
                setSentTo(null)
                setWindow(null)
                action.clear()
              }}
            />
            <Alert tone="info">
              {providerName ? labels.emailNoCodeHint(providerName) : labels.emailNoCodeHintPlain}
            </Alert>
          </div>
        ) : (
          <form onSubmit={send} noValidate aria-labelledby={ids.title} className={authStyles.stack}>
            {action.error && !reauth && <Alert tone="danger">{action.error.message}</Alert>}
            <AddressField
              labels={labels}
              id={ids.email}
              value={email}
              onChange={setEmail}
              problem={attempt.attempted ? problem : undefined}
            />
            {reauth && (
              <ReauthPrompt
                labels={labels}
                providers={providers}
                canContinue={!!onProviderReauth && !!email.trim() && SHAPE.test(email.trim())}
                onProvider={(provider) => onProviderReauth?.(provider, email.trim())}
                onRetry={() => {
                  setReauth(false)
                  action.clear()
                }}
              />
            )}
            {!reauth && (
              <Button
                type="submit"
                className={styles.submit}
                loading={action.busy}
                loadingLabel={labels.submitting}
              >
                {labels.emailRequiredSend}
              </Button>
            )}
          </form>
        )}
        <DiscardPath
          labels={labels}
          providers={providers}
          discard={onDiscard}
          onDiscarded={onDiscarded}
          onProviderReauth={onDiscardReauth}
        />
        <LeaveActions labels={labels} onSignOut={onSignOut} />
      </div>
    </div>
  )
}
