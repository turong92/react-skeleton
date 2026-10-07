import { ErrorCodes } from '@skeleton/api-client'
import { Alert, Button, CodeEntry, type ExpiryInput } from '@skeleton/ui'
import { useEffect, useRef, useState } from 'react'
import type { ReauthCredential } from '../account/accountApi'
import { useCodeClock } from '../codeClockContext'
import { codeWindowOf, estimateCodeWindow, type CodeWindow } from '../codeWindow'
import type { ReauthKind } from '../reauth/kind'
import { PasswordField } from './PasswordField'
import styles from './auth.module.css'
import { codeFailureOf } from './codeErrors'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { labelOfMethod } from './methodsList'
import { useAction } from './useAction'
import { useCountdown } from './useCountdown'

export type ReauthProofProps = {
  /** 계정에 맞는 증거(`reauthKindOf`) — 서버가 같은 규칙으로 강제한다 */
  kind: ReauthKind
  /** 인증번호를 보낼 계정 주소(안내 문장) */
  email: string | null
  /** 이미 연결된 소셜 제공자 — `provider` 종류가 다시 동의할 곳 */
  providers?: string[]
  /** `code`: 계정 주소로 6자리를 보낸다(`requestReauthConfirmation` · 삭제는 `requestDeleteConfirmation`). 없으면 인증번호 칸이 바로 열린다 */
  requestCode?: () => Promise<unknown>
  /** 증거가 준비되면(없어지면 null) — 부모가 작업을 낼 때 싣는다. `provider` 종류는 왕복이라 값을 올리지 않는다 */
  onChange: (credential: ReauthCredential | null) => void
  /** 이 증거를 쓴 작업이 던진 오류 그대로 — 틀린 비밀번호 · 틀린/만료 인증번호 · 실패한 제공자 증명을 이 자리가 말해 준다(`isReauthFailure`) */
  failure?: unknown
  /** `provider`: 이 제공자의 동의 화면으로 보낸다(하려던 작업은 부모가 state 에 묶어 둔다) */
  onProvider?: (provider: string) => void
  /** 제공자 동의를 이미 마치고 돌아왔다 — 그 제공자 이름(부모가 증거를 쥐고 있다) */
  confirmedWith?: string
  /** 인증번호 다시 받기 쿨다운(초) — 서버는 30초 안의 새 요청도 받지만 메일 한도(시간당 5번)가 있어 막아 둔다 */
  resendCooldownSeconds?: number
  /**
   * 인증번호 유효 시간(초) — 서버가 요청 응답에 만료 시각을 안 줄 때(옛 서버) 남은 시간을 어림하는 값. 백엔드 기본: 재인증 · 삭제 확인 · 이메일 변경 모두 10분(600). 응답에 `expiresAt` 이 있으면 그 값이 이긴다
   */
  codeTtlSeconds?: number
  /** `requestCode` 없이 인증번호 칸이 바로 열릴 때(다른 곳에서 이미 보냈다) 그 코드의 만료 시각 */
  codeExpiresAt?: ExpiryInput
  disabled?: boolean
  labels?: Partial<AuthLabels>
}

type Phase = 'idle' | 'sent' | 'entered'

/**
 * 민감한 작업의 다시 인증 입력 — 계정에 맞는 한 가지를 그 자리에서 받는다.
 * 비밀번호는 현재 비밀번호 칸, 비밀번호 없는 계정은 「인증번호 받기」 → 메일의 6자리를 **같은 자리에서** 입력(`CodeEntry`),
 * 주소가 없는 계정은 이미 연결된 제공자로 동의를 다시 거친다. 증거는 `onChange` 로 올리고 서버 검증은 작업이 한다.
 */
export function ReauthProof({
  kind,
  email,
  providers = [],
  requestCode,
  onChange,
  failure,
  onProvider,
  confirmedWith,
  resendCooldownSeconds = 30,
  codeTtlSeconds = 600,
  codeExpiresAt,
  disabled,
  labels: given,
}: ReauthProofProps) {
  const labels = mergeLabels(given)
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<Phase>(requestCode ? 'idle' : 'sent')
  const [expired, setExpired] = useState(false)
  /** 이 번호의 시간이 다 됐다(서버가 더 다시 보낼 수 없다고 했을 때 「처음부터 다시」를 보인다) */
  const [timedOut, setTimedOut] = useState(false)
  /** 이미 읽은(고치려 다시 입력하기 시작한) 오류 — 같은 오류를 계속 붙여 두지 않는다 */
  const [dismissed, setDismissed] = useState<unknown>(null)
  const mail = useAction(labels)
  const wait = useCountdown()
  const now = useCodeClock()
  /** 방금 보낸 코드의 유효 창 — 서버가 준 시각이 있으면 그것, 없으면 `codeTtlSeconds` 로 어림(`source: 'estimate'`) */
  const [codeWindow, setCodeWindow] = useState<CodeWindow | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  // 서버가 증거를 거절했다 — 인증번호는 비우고(남은 횟수는 아래에 그린다), 만료 · 소진이면 새로 받게 한다. 렌더 중 상태 조정(이전 값과 비교)이라 효과가 필요 없다
  const [seenFailure, setSeenFailure] = useState<unknown>(null)
  if (failure !== seenFailure) {
    setSeenFailure(failure)
    if (failure && kind === 'code') {
      if (codeFailureOf(failure).kind === 'expired') {
        setExpired(true)
        setPhase(requestCode ? 'idle' : 'sent')
      } else setPhase('sent')
    }
  }
  useEffect(() => {
    if (failure && kind === 'code') onChangeRef.current(null)
  }, [failure, kind])

  async function sendCode() {
    setExpired(false)
    setTimedOut(false)
    let response: unknown
    const ok = await mail.run(async () => {
      response = await requestCode?.()
    })
    if (ok) {
      setCodeWindow(
        codeWindowOf(response) ??
          estimateCodeWindow(now(), {
            ttlSeconds: codeTtlSeconds,
            cooldownSeconds: resendCooldownSeconds,
          }),
      )
      setPhase('sent')
      onChange(null) // 새 코드 — 지난 번호는 버려진다
      wait.start(resendCooldownSeconds)
    }
  }

  if (kind === 'password') {
    const wrong =
      failure &&
      authErrorMessage(failure, labels).code === ErrorCodes.ACCOUNT_CURRENT_PASSWORD_INVALID
    const failed = failure && !wrong ? authErrorMessage(failure, labels) : null
    return (
      <PasswordField
        label={labels.currentPassword}
        labels={labels}
        autoComplete="current-password"
        value={password}
        onChange={(next) => {
          setPassword(next)
          onChange(next ? { currentPassword: next } : null)
        }}
        error={wrong ? labels.errorCurrentPassword : failed?.message}
      />
    )
  }

  if (kind === 'provider') {
    const failed = failure ? authErrorMessage(failure, labels) : null
    return (
      <div className={styles.stack} data-testid="reauth-provider">
        {confirmedWith ? (
          <Alert tone="success">
            {labels.reauthProviderDone(labelOfMethod(confirmedWith, labels))}
          </Alert>
        ) : providers.length === 0 ? (
          <Alert tone="warning">{labels.reauthProviderNone}</Alert>
        ) : (
          <>
            <p className={styles.muted}>{labels.reauthProviderHint}</p>
            {failed && <Alert tone="danger">{failed.message}</Alert>}
            <div className={styles.row}>
              {providers.map((provider) => (
                <Button
                  key={provider}
                  variant="secondary"
                  disabled={disabled || !onProvider}
                  onClick={() => onProvider?.(provider)}
                >
                  {labels.reauthProviderButton(labelOfMethod(provider, labels))}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // 메일로 받은 인증번호
  const exhausted = codeWindow?.resendExhausted === true
  const shown = failure && failure !== dismissed ? failure : null
  const reason = shown ? codeFailureOf(shown) : null
  const codeError =
    reason?.kind === 'invalid'
      ? labels.codeInvalid(reason.attemptsLeft)
      : reason && reason.kind !== 'expired'
        ? authErrorMessage(shown, labels).message
        : undefined
  return (
    <div className={styles.stack} data-testid="reauth-code">
      {mail.error && <Alert tone="danger">{mail.error.message}</Alert>}
      {expired && <Alert tone="warning">{labels.reauthCodeExpired}</Alert>}
      {phase === 'idle' ? (
        <>
          <p className={styles.muted}>{labels.reauthCodeHint(email ?? '')}</p>
          <div>
            <Button
              variant="secondary"
              disabled={disabled}
              loading={mail.busy}
              loadingLabel={labels.submitting}
              onClick={() => void sendCode()}
            >
              {labels.reauthCodeSend}
            </Button>
          </div>
        </>
      ) : (
        <>
          {requestCode && <p className={styles.muted}>{labels.reauthCodeSent(email ?? '')}</p>}
          <CodeEntry
            label={labels.codeGroupLabel}
            digitLabel={labels.codeDigit}
            disabled={disabled}
            onChange={(code) => {
              setDismissed(failure)
              if (code.length < 6) {
                setPhase('sent')
                onChange(null)
              }
            }}
            onComplete={(code) => {
              setPhase('entered')
              onChange({ confirmationCode: code })
            }}
            error={codeError}
            expiresAt={codeWindow?.expiresAt ?? codeExpiresAt}
            expirySource={codeWindow?.source ?? 'server'}
            now={now}
            timeLabels={{
              remaining: labels.codeTimeLeft,
              minuteLeft: labels.codeTimeMinute,
              secondsLeft: () => labels.codeTimeTen,
              expired: labels.codeTimeUp,
            }}
            onExpire={() => {
              // 시간이 다 됐다 — 이 번호는 서버가 어차피 받지 않는다. 증거를 거두고 새로 받게 한다
              setPhase('sent')
              setTimedOut(true)
              onChange(null)
            }}
            resend={
              requestCode && !exhausted
                ? {
                    label: labels.codeResend,
                    onResend: () => void sendCode(),
                    secondsLeft: wait.seconds,
                    labelWhileWaiting: labels.codeResendWaiting,
                  }
                : undefined
            }
          />
          {exhausted && (
            <p role="status" className={styles.muted}>
              {labels.codeNoMoreResends}
            </p>
          )}
          {exhausted && timedOut && requestCode && (
            <div>
              <Button
                variant="secondary"
                onClick={() => {
                  setCodeWindow(null)
                  setTimedOut(false)
                  setPhase('idle')
                }}
              >
                {labels.codeRestart}
              </Button>
            </div>
          )}
          {phase === 'entered' && (
            <p role="status" className={styles.muted}>
              {labels.reauthCodeEntered}
            </p>
          )}
        </>
      )}
    </div>
  )
}
