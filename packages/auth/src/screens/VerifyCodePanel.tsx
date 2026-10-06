import { Alert, CodeEntry } from '@skeleton/ui'
import { Button } from '@skeleton/ui'
import { useState } from 'react'
import styles from './auth.module.css'
import { codeFailureOf } from './codeErrors'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { useCountdown } from './useCountdown'

export type VerifyCodePanelProps = {
  /** 코드를 보낸 주소(안내 문장에) */
  email: string
  /** 6자리를 서버에 낸다. 성공하면 호출자가 이어 간다(로그인 · 설정 갱신). 실패는 던진다 — 화면이 가른다(틀림 · 만료 · 429) */
  onVerify: (code: string) => Promise<unknown>
  /** 같은 시도에 새 코드를 받는다 */
  onResend?: () => Promise<void>
  /** 만료 · 소진 · 주소를 잘못 쓴 사람이 처음부터 다시 */
  onStartOver: () => void
  /** 다시 받기 쿨다운(초). 기본 30 — 서버도 30초 안의 요청은 조용히 무시한다 */
  resendCooldownSeconds?: number
  labels?: Partial<AuthLabels>
}

/**
 * 메일로 받은 6자리 인증번호를 같은 화면에서 입력 — 가입 인증 · 이메일 변경이 쓴다(FINAL-3 초안). 6자리를 채우면 버튼 없이 제출되고,
 * 틀리면 남은 횟수와 함께 칸을 비워 다시 받고, 만료 · 소진이면 처음부터 다시 하라고 말하고, 429 면 기다릴 시간을 센다.
 */
export function VerifyCodePanel({
  email,
  onVerify,
  onResend,
  onStartOver,
  resendCooldownSeconds = 30,
  labels: given,
}: VerifyCodePanelProps) {
  const labels = mergeLabels(given)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [expired, setExpired] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const resendWait = useCountdown()
  const rateWait = useCountdown()

  async function submit(code: string) {
    setBusy(true)
    setNote(null)
    try {
      await onVerify(code)
    } catch (caught) {
      const failure = codeFailureOf(caught)
      if (failure.kind === 'expired') setExpired(true)
      else if (failure.kind === 'invalid') setError(labels.codeInvalid(failure.attemptsLeft))
      else {
        const info = authErrorMessage(caught, labels)
        setError(info.message)
        if (info.retryAfterSeconds) rateWait.start(info.retryAfterSeconds)
      }
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    if (!onResend) return
    setError(undefined)
    try {
      await onResend()
      setNote(labels.codeResent)
    } catch (caught) {
      const info = authErrorMessage(caught, labels)
      setError(info.message)
    }
    resendWait.start(resendCooldownSeconds)
  }

  if (expired)
    return (
      <div className={styles.stack}>
        <Alert tone="warning">{labels.codeExpired}</Alert>
        <div>
          <Button onClick={onStartOver}>{labels.codeRestart}</Button>
        </div>
      </div>
    )

  const waiting = Math.max(resendWait.seconds, rateWait.seconds)
  return (
    <div className={styles.stack} data-testid="verify-code">
      <h2>{labels.codeTitle}</h2>
      <p>{labels.codeBody(email)}</p>
      <p className={styles.muted}>{labels.checkEmailSpam}</p>
      <CodeEntry
        label={labels.codeGroupLabel}
        digitLabel={labels.codeDigit}
        onComplete={(code) => void submit(code)}
        error={error}
        busy={busy || rateWait.seconds > 0}
        resend={
          onResend
            ? {
                label: labels.codeResend,
                onResend: () => void resend(),
                secondsLeft: waiting,
                waitLabel: labels.codeResendIn,
              }
            : undefined
        }
      />
      {busy && (
        <p role="status" className={styles.muted}>
          {labels.codeChecking}
        </p>
      )}
      {note && (
        <p role="status" className={styles.muted}>
          {note}
        </p>
      )}
      <div>
        <Button variant="ghost" onClick={onStartOver}>
          {labels.checkEmailWrongAddress}
        </Button>
      </div>
    </div>
  )
}
