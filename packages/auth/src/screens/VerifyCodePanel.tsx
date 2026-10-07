import {
  Alert,
  Button,
  CodeEntry,
  expiryMillis,
  secondsRemaining,
  type ExpiryInput,
} from '@skeleton/ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useCodeClock } from '../codeClockContext'
import { codeWindowOf, estimateCodeWindow, type CodeWindow } from '../codeWindow'
import styles from './auth.module.css'
import { codeFailureOf } from './codeErrors'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { useCountdown } from './useCountdown'

export type VerifyCodePanelProps = {
  /** 코드를 보낸 주소(안내 문장에) */
  email: string
  /** 제목 · 안내 문장을 바꾼다 — 기본은 가입 인증의 문구(10분) — 유효 시간이 다른 흐름은 자기 문구를 준다 */
  title?: string
  description?: string
  /** 6자리를 서버에 낸다. 성공하면 호출자가 이어 간다(로그인 · 설정 갱신). 실패는 던진다 — 화면이 가른다(틀림 · 만료 · 429) */
  onVerify: (code: string) => Promise<unknown>
  /**
   * 같은 시도에 새 코드를 받는다. 응답에 `expiresAt` · `resendAvailableAt`(서버가 주면)이 있으면 그 값으로, 없으면 `codeTtlSeconds` 로 어림해 남은 시간을 새로 센다
   */
  onResend?: () => Promise<unknown>
  /** 코드가 만료되는 절대 시각 — 서버 값이면 `expirySource="server"`(기본은 어림). 없으면 남은 시간 줄을 안 그린다 */
  expiresAt?: ExpiryInput
  expirySource?: 'server' | 'estimate'
  /** 다시 받기가 다시 눌리는 절대 시각(새로고침 뒤 쿨다운 이어 가기) */
  resendAvailableAt?: ExpiryInput
  /** 서버가 `resendAvailableAt: null` 을 줬다 — 이 시도는 더 다시 보낼 수 없다: 「다시 받기」를 숨기고 안내, 시간이 다 되면 처음부터 다시 */
  resendExhausted?: boolean
  /** 다시 받을 수 없을 때의 안내(기본 일반 문구 — 가입은 「처음부터 다시 가입해 주세요」) */
  resendExhaustedNote?: string
  /** 안내 문장과 인증번호 칸 사이(예: 닉네임이 겹쳐 그 자리에서 다시 입력받는 작은 칸) — 남은 시간은 계속 흐른다 */
  above?: ReactNode
  /** 문서화된 유효 시간(초) — 서버가 새 만료 시각을 안 줄 때 「다시 받기」 뒤의 어림에 쓴다. 가입 코드는 600(10분) */
  codeTtlSeconds?: number
  /**
   * 시간이 다 된 뒤 「다시 받기」가 하는 일 — `resend`(기본): 같은 시도에 새 코드. `restart`(가입): 먼저 같은 시도에 다시 받기를 해 본다 —
   * 새 백엔드는 만료된 시도에도 새 번호를 보내고 응답에 새 `expiresAt` 을 주므로 그 자리에서 타이머를 다시 시작하고, 응답에 시각이 없으면(옛 서버는 조용히 무시한다)
   * 처음부터 다시(주소는 남는다)
   */
  expiredResend?: 'resend' | 'restart'
  /** 시간이 다 됐다(한 번) — 「다시 받기」가 이 패널에 없을 때 부모가 자기 버튼으로 포커스를 옮긴다 */
  onExpire?: () => void
  /** 만료 · 소진 · 주소를 잘못 쓴 사람이 처음부터 다시 */
  onStartOver: () => void
  /** 다시 받기 쿨다운(초). 기본 30 — 서버도 30초 안의 요청은 조용히 무시한다 */
  resendCooldownSeconds?: number
  labels?: Partial<AuthLabels>
}

/**
 * 메일로 받은 6자리 인증번호를 같은 화면에서 입력 — 가입 인증 · 이메일 변경이 쓴다. 6자리를 채우면 버튼 없이 제출되고,
 * 틀리면 남은 횟수와 함께 칸을 비워 다시 받고, 만료 · 소진이면 처음부터 다시 하라고 말하고, 429 면 기다릴 시간을 센다.
 */
export function VerifyCodePanel({
  email,
  title,
  description,
  onVerify,
  onResend,
  onStartOver,
  resendCooldownSeconds = 30,
  expiresAt: givenExpiresAt,
  expirySource = 'estimate',
  resendAvailableAt,
  resendExhausted: givenExhausted = false,
  resendExhaustedNote,
  above,
  codeTtlSeconds = 600,
  expiredResend = 'resend',
  onExpire,
  labels: given,
}: VerifyCodePanelProps) {
  const labels = mergeLabels(given)
  const now = useCodeClock()
  /** 다시 받은 뒤의 새 창 — 부모가 새 `expiresAt` 을 주면 그쪽이 이긴다 */
  const [renewed, setRenewed] = useState<CodeWindow | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [seenExpiry, setSeenExpiry] = useState(givenExpiresAt)
  if (givenExpiresAt !== seenExpiry) {
    setSeenExpiry(givenExpiresAt)
    setRenewed(null)
    setTimedOut(false)
  }
  const expiresAt = renewed?.expiresAt ?? expiryMillis(givenExpiresAt) ?? undefined
  const source = renewed ? renewed.source : expirySource
  const exhausted = renewed ? renewed.resendExhausted === true : givenExhausted
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [expired, setExpired] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const resendWait = useCountdown()
  const rateWait = useCountdown()

  // 새로고침으로 돌아왔다 — 남은 쿨다운을 이어 간다(마운트 뒤에만: 서버 렌더와 첫 렌더가 같다)
  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current) return
    resumed.current = true
    const until = expiryMillis(resendAvailableAt)
    if (until === null) return
    const left = secondsRemaining(until, now())
    if (left > 0) resendWait.start(left)
  })

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

  const resending = useRef(false)

  async function resend() {
    if (!onResend || resending.current) return // 진행 중에는 다시 보내지 않는다(두 번 누르면 요청 둘)
    resending.current = true
    setError(undefined)
    const afterExpiry = timedOut && expiredResend === 'restart'
    try {
      const response = await onResend()
      const answered = codeWindowOf(response)
      // 만료 뒤의 다시 받기가 소용없었다 — 옛 서버는 시각 없이 조용히 무시하고, 예산을 다 쓴 시도는 지나간 `expiresAt`(과 `resendAvailableAt: null`)을 준다: 막다른 길 대신 처음부터
      if (afterExpiry && (answered === null || answered.expiresAt <= now())) return onStartOver()
      if (answered && answered.expiresAt <= now()) {
        setExpired(true) // 시간이 이미 지난 새 시각 — 새 번호를 보냈다고 말하지 않는다
        return
      }
      setNote(labels.codeResent)
      // 서버가 새 시각을 주면 그것으로, 아니면 문서화된 유효 시간으로 어림한다(어림은 `data-expiry-source="estimate"`)
      const fresh =
        codeWindowOf(response) ??
        estimateCodeWindow(now(), {
          ttlSeconds: codeTtlSeconds,
          cooldownSeconds: resendCooldownSeconds,
        })
      setRenewed(fresh)
      setTimedOut(false)
      resendWait.start(
        fresh.resendAvailableAt
          ? secondsRemaining(fresh.resendAvailableAt, now())
          : resendCooldownSeconds,
      )
      return
    } catch (caught) {
      const info = authErrorMessage(caught, labels)
      setError(info.message)
    } finally {
      resending.current = false
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
      <h2>{title ?? labels.codeTitle}</h2>
      <p>{description ?? labels.codeBody(email)}</p>
      <p className={styles.muted}>{labels.checkEmailSpam}</p>
      {above}
      <CodeEntry
        label={labels.codeGroupLabel}
        digitLabel={labels.codeDigit}
        onComplete={(code) => void submit(code)}
        error={error}
        busy={busy || rateWait.seconds > 0}
        expiresAt={expiresAt}
        expirySource={source}
        now={now}
        timeLabels={{
          remaining: labels.codeTimeLeft,
          minuteLeft: labels.codeTimeMinute,
          secondsLeft: () => labels.codeTimeTen,
          expired: labels.codeTimeUp,
        }}
        onExpire={() => {
          setTimedOut(true)
          onExpire?.()
        }}
        resend={
          onResend && !exhausted
            ? {
                label: labels.codeResend,
                onResend: () => void resend(),
                secondsLeft: waiting,
                labelWhileWaiting: labels.codeResendWaiting,
              }
            : undefined
        }
      />
      {exhausted && (
        <p role="status" className={styles.muted}>
          {resendExhaustedNote ?? labels.codeNoMoreResends}
        </p>
      )}
      {exhausted && timedOut && (
        <div>
          <Button onClick={onStartOver}>{labels.codeRestart}</Button>
        </div>
      )}
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
