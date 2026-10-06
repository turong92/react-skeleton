import { ErrorCodes } from '@skeleton/api-client'
import { Alert, Button, CodeEntry } from '@skeleton/ui'
import { useEffect, useRef, useState } from 'react'
import type { ReauthCredential } from '../account/accountApi'
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
  disabled,
  labels: given,
}: ReauthProofProps) {
  const labels = mergeLabels(given)
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<Phase>(requestCode ? 'idle' : 'sent')
  const [expired, setExpired] = useState(false)
  /** 이미 읽은(고치려 다시 입력하기 시작한) 오류 — 같은 오류를 계속 붙여 두지 않는다 */
  const [dismissed, setDismissed] = useState<unknown>(null)
  const mail = useAction(labels)
  const wait = useCountdown()
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
    const ok = await mail.run(async () => {
      await requestCode?.()
    })
    if (ok) {
      setPhase('sent')
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
            resend={
              requestCode
                ? {
                    label: labels.codeResend,
                    onResend: () => void sendCode(),
                    secondsLeft: wait.seconds,
                    waitLabel: labels.codeResendIn,
                  }
                : undefined
            }
          />
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
