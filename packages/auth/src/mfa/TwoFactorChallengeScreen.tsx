import { Alert, Button, CodeEntry, Field, Input } from '@skeleton/ui'
import { useRef, useState, type FormEvent } from 'react'
import { useCodeClock } from '../codeClockContext'
import { deletionPendingOf, type DeletionPending } from '../pendingDeletion'
import { AuthLayout } from '../screens/AuthLayout'
import { DeletionPendingScreen } from '../screens/DeletionPendingScreen'
import styles from '../screens/auth.module.css'
import { authErrorMessage } from '../screens/errors'
import { mergeLabels, type AuthLabels } from '../screens/labels'
import { useCountdown } from '../screens/useCountdown'
import { MFA_CHALLENGE_ATTEMPTS } from './codes'
import { isMfaChallengeExpired, isMfaCodeWrong, mfaAttemptsLeft } from './errors'
import type { MfaRequired, MfaVerifyInput } from './types'

export type TwoFactorChallengeScreenProps = {
  /** `mfaRequiredOf(error)` - 1단계가 맞았을 때 서버가 준 대기. `mfaToken` 은 이 화면의 메모리에만 있다 */
  mfa: MfaRequired
  /**
   * 코드를 서버에 낸다(`session.mfaLogin` + 로그인 뒤 이동). 실패는 던진다 - 틀림(400)은 남은 시도,
   * 만료 · 시도 소진(410)은 처음부터, 계정 한도(429)는 기다릴 시간으로 말하고 같은 대기로 다시 낼 수 있다
   */
  onVerify: (input: MfaVerifyInput) => Promise<unknown>
  /** 「로그인으로 돌아가기」 - 대기가 끝났다(1단계부터 다시) */
  onRestart: () => void
  /**
   * 탈퇴 대기 계정이 코드까지 맞췄다(`403 AUTH.ACCOUNT_DELETION_PENDING` - 2단계를 **먼저** 묻고, 탈퇴 대기 안내는 그 뒤에 온다) - 「탈퇴를 취소할까요?」로 바뀌고,
   * 취소는 토큰으로 로그인한다(`session.cancelDeletion` + 이동; 서버가 2단계를 다시 묻지 않는다). 안 주면 안내만
   */
  onCancelDeletion?: (restoreToken: string) => Promise<unknown>
  /** 삭제 예정일 표기 */
  formatDate?: (iso: string) => string
  /** 시계(기본: 인증번호 시계 - 서버 보정을 넣은 앱은 그 시계) */
  now?: () => number
  labels?: Partial<AuthLabels>
}

type Mode = 'app' | 'recovery'

/**
 * 로그인의 두 번째 단계 - 6자리 인증 앱 코드(`CodeEntry`, 다 채우면 버튼 없이 제출)와, 앱을 잃은 사람의 「복구 코드로 들어가기」.
 * 틀리면 남은 시도, 대기가 끝나면(5분 · 5번) 처음부터, 한도(429)면 기다릴 시간을 말한다. 비밀번호 · 링크 · 소셜 · 탈퇴 취소가 모두 여기로 온다
 */
export function TwoFactorChallengeScreen({
  mfa,
  onVerify,
  onRestart,
  onCancelDeletion,
  formatDate,
  now: givenNow,
  labels: given,
}: TwoFactorChallengeScreenProps) {
  const labels = mergeLabels(given)
  const clock = useCodeClock()
  const now = givenNow ?? clock
  const [mode, setMode] = useState<Mode>('app')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [expired, setExpired] = useState(false)
  const [recovery, setRecovery] = useState('')
  /** 코드는 맞았고 이 계정은 탈퇴 대기 중이다 - 취소용 토큰은 이 상태(메모리)에만 있다 */
  const [pending, setPending] = useState<DeletionPending | null>(null)
  const wrong = useRef(0)
  const inFlight = useRef(false)
  const wait = useCountdown()
  const canRecover = mfa.methods.includes('recovery_code')
  const canApp = mfa.methods.includes('totp')

  async function submit(input: MfaVerifyInput) {
    if (inFlight.current) return // 확인하는 사이 다시 내지 않는다(시도 하나를 더 쓰지 않게)
    inFlight.current = true
    setBusy(true)
    setError(undefined)
    try {
      await onVerify(input)
      return // 성공이면 호출자가 이동한다 - 그 사이 다시 누르지 못하게 busy 를 유지한다
    } catch (caught) {
      const waiting = deletionPendingOf(caught)
      if (waiting) setPending(waiting)
      else if (isMfaChallengeExpired(caught)) setExpired(true)
      else if (isMfaCodeWrong(caught)) {
        wrong.current += 1
        setError(
          labels.mfaCodeWrong(mfaAttemptsLeft(caught) ?? MFA_CHALLENGE_ATTEMPTS - wrong.current),
        )
      } else {
        const info = authErrorMessage(caught, labels)
        setError(info.message)
        if (info.retryAfterSeconds) wait.start(info.retryAfterSeconds)
      }
    }
    inFlight.current = false
    setBusy(false)
  }

  function submitRecovery(event: FormEvent) {
    event.preventDefault()
    if (wait.seconds > 0) return // 한도에 걸렸다 - 이유는 칸 아래에 적혀 있다
    const value = recovery.trim()
    if (!value) return setError(labels.mfaRecoveryMissing)
    void submit({ recoveryCode: value })
  }

  function switchTo(next: Mode) {
    setMode(next)
    setError(undefined)
    setRecovery('')
  }

  if (pending)
    return (
      <DeletionPendingScreen
        pending={pending}
        onCancel={onCancelDeletion}
        onLeave={onRestart}
        formatDate={formatDate}
        labels={given}
      />
    )

  if (expired)
    return (
      <AuthLayout focusTitle title={labels.mfaExpiredTitle}>
        <div className={styles.stack} aria-live="polite">
          <Alert tone="warning">{labels.mfaExpiredBody}</Alert>
          <div>
            <Button onClick={onRestart}>{labels.mfaBackToSignIn}</Button>
          </div>
        </div>
      </AuthLayout>
    )

  return (
    <AuthLayout focusTitle title={labels.mfaTitle}>
      <div className={styles.stack}>
        <p>{mode === 'app' ? labels.mfaBody : labels.mfaRecoveryBody}</p>
        {mode === 'app' ? (
          <CodeEntry
            label={labels.mfaCodeGroup}
            digitLabel={labels.codeDigit}
            onComplete={(code) => void submit({ code })}
            error={error}
            busy={busy || wait.seconds > 0}
            expiresAt={mfa.expiresAt ?? undefined}
            expirySource="server"
            now={now}
            timeLabels={{
              remaining: labels.mfaTimeLeft,
              minuteLeft: labels.mfaTimeMinute,
              secondsLeft: () => labels.mfaTimeTen,
              expired: labels.mfaTimeUp,
            }}
            onExpire={() => setExpired(true)}
          />
        ) : (
          <form className={styles.form} onSubmit={submitRecovery} noValidate>
            <Field label={labels.mfaRecoveryLabel} error={error}>
              {(control) => (
                <Input
                  {...control}
                  value={recovery}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={busy || wait.seconds > 0}
                  onChange={(event) => setRecovery(event.target.value)}
                />
              )}
            </Field>
            <div>
              <Button
                type="submit"
                loading={busy}
                loadingLabel={labels.submitting}
                aria-disabled={wait.seconds > 0 || undefined}
              >
                {labels.mfaRecoverySubmit}
              </Button>
            </div>
          </form>
        )}
        {busy && (
          <p role="status" className={styles.muted}>
            {labels.mfaChecking}
          </p>
        )}
        {mode === 'app' && canRecover && (
          <div>
            <Button variant="ghost" onClick={() => switchTo('recovery')}>
              {labels.mfaUseRecovery}
            </Button>
          </div>
        )}
        {mode === 'recovery' && canApp && (
          <div>
            <Button variant="ghost" onClick={() => switchTo('app')}>
              {labels.mfaUseApp}
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
