import { Button } from '@skeleton/ui'
import { useState } from 'react'
import styles from './auth.module.css'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { useCountdown } from './useCountdown'

export type CheckEmailPanelProps = {
  email: string
  labels?: Partial<AuthLabels>
  /** 제목을 바꾼다(가입 · 링크 로그인 · 비밀번호 찾기 · 이메일 변경이 같은 틀을 쓴다) */
  title?: string
  body?: string
  /** 있으면 「다시 보내기」(쿨다운 뒤에만 다시 눌린다) */
  onResend?: () => Promise<void>
  /** 처음부터 다시(주소를 잘못 쓴 사람) */
  onStartOver?: () => void
  /** 다시 보내기 쿨다운(초). 기본 30 */
  resendCooldownSeconds?: number
}

/** 「메일을 확인하세요」 상태 — 가입 · 매직링크 · 비밀번호 찾기 · 이메일 변경이 함께 쓴다 */
export function CheckEmailPanel({
  email,
  labels: given,
  title,
  body,
  onResend,
  onStartOver,
  resendCooldownSeconds = 30,
}: CheckEmailPanelProps) {
  const labels = mergeLabels(given)
  const { seconds, start } = useCountdown()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function resend() {
    if (!onResend) return
    setBusy(true)
    setMessage(null)
    try {
      await onResend()
      setMessage(labels.checkEmailResent)
      start(resendCooldownSeconds)
    } catch (error) {
      const info = authErrorMessage(error, labels)
      setMessage(info.message)
      if (info.retryAfterSeconds) start(info.retryAfterSeconds)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.stack} data-testid="check-email">
      <h2>{title ?? labels.checkEmailTitle}</h2>
      <p>{body ?? labels.checkEmailBody(email)}</p>
      <p className={styles.muted}>{labels.checkEmailSpam}</p>
      {message && (
        <p role="status" className={styles.muted}>
          {message}
        </p>
      )}
      <div className={styles.row}>
        {onResend && (
          <Button
            variant="secondary"
            onClick={resend}
            loading={busy}
            loadingLabel={labels.submitting}
            disabled={seconds > 0}
          >
            {seconds > 0 ? labels.checkEmailResendIn(seconds) : labels.checkEmailResend}
          </Button>
        )}
        {onStartOver && (
          <Button variant="ghost" onClick={onStartOver}>
            {labels.checkEmailWrongAddress}
          </Button>
        )}
      </div>
    </div>
  )
}
