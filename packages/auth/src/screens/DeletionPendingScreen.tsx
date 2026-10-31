import { ErrorCodes } from '@skeleton/api-client'
import { Alert, Button } from '@skeleton/ui'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DeletionPending } from '../pendingDeletion'
import { AuthLayout } from './AuthLayout'
import styles from './auth.module.css'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'

export type DeletionPendingScreenProps = {
  /** `deletionPendingOf(error)` — 서버가 준 삭제 예정일 · 취소용 토큰(self-restore 가 켜졌을 때만) */
  pending: DeletionPending
  /**
   * 토큰으로 탈퇴를 취소하고 로그인한다(`session.cancelDeletion` + 로그인 뒤 이동). 안 주면 · 토큰이 없으면 안내만 보인다.
   * 실패는 던진다 — `410 ACCOUNT.TOKEN_INVALID` 는 「시간이 지났어요」, 그 밖은 문구로 보이고 같은 토큰으로 다시 누를 수 있다
   */
  onCancel?: (restoreToken: string) => Promise<unknown>
  /** 「그대로 두기」 · 「로그인으로 돌아가기」가 가는 곳(링크). 로그인 화면 안에서 쓰면 `onLeave` */
  leaveTo?: string
  /** 로그인 화면 안에서: 화면을 닫고 양식으로 돌아간다(토큰을 버린다) */
  onLeave?: () => void
  /** 삭제 예정일 표기 — 기본은 브라우저 로케일의 날짜. 앱은 자기 로케일 · 시간대 규칙(`@skeleton/time`)을 넘긴다 */
  formatDate?: (iso: string) => string
  labels?: Partial<AuthLabels>
}

const defaultFormat = (iso: string) => new Date(iso).toLocaleDateString()

/**
 * 탈퇴 대기 중인 계정이 로그인했을 때(`403 AUTH.ACCOUNT_DELETION_PENDING`) 로그인 · 링크 · 소셜 콜백이 같이 쓰는 화면 —
 * 「탈퇴를 취소할까요?」(취소하고 계속 쓰기 · 그대로 두기), 토큰이 없으면(서버가 self-restore 를 껐다) 안내만, 취소가 늦으면(410) 다시 로그인.
 * **토큰은 이 화면의 메모리에만 있다** — 저장소 · 주소 · 마크업 어디에도 쓰지 않는다(새로고침하면 사라지고 다시 로그인한다).
 */
export function DeletionPendingScreen({
  pending,
  onCancel,
  leaveTo,
  onLeave,
  formatDate = defaultFormat,
  labels: given,
}: DeletionPendingScreenProps) {
  const labels = mergeLabels(given)
  const [phase, setPhase] = useState<'ask' | 'expired'>('ask')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const inFlight = useRef(false)
  const date = pending.purgeAfter ? formatDate(pending.purgeAfter) : null
  const token = pending.restoreToken

  async function cancel() {
    if (!token || !onCancel || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setFailure(null)
    try {
      await onCancel(token)
      // 성공이면 호출자가 이동한다 — 그 사이 다시 누르지 못하게 busy 를 유지한다
    } catch (error) {
      inFlight.current = false
      setBusy(false)
      const info = authErrorMessage(error, labels)
      if (info.code === ErrorCodes.ACCOUNT_TOKEN_INVALID) setPhase('expired')
      else setFailure(info.message)
    }
  }

  const leave = (label: string, variant: 'secondary' | 'ghost' = 'ghost') =>
    onLeave ? (
      <Button variant={variant} onClick={onLeave}>
        {label}
      </Button>
    ) : leaveTo ? (
      <Link className={styles.link} to={leaveTo}>
        {label}
      </Link>
    ) : null

  if (phase === 'expired')
    return (
      <AuthLayout focusTitle title={labels.deletionExpiredTitle}>
        <div className={styles.stack} aria-live="polite">
          <Alert tone="warning">{labels.deletionExpiredBody}</Alert>
          <div>{leave(labels.backToSignIn, 'secondary')}</div>
        </div>
      </AuthLayout>
    )

  if (!token || !onCancel)
    return (
      <AuthLayout focusTitle title={labels.deletionNoRestoreTitle}>
        <div className={styles.stack}>
          <Alert tone="warning">{labels.deletionNoRestoreBody(date)}</Alert>
          <div>{leave(labels.backToSignIn, 'secondary')}</div>
        </div>
      </AuthLayout>
    )

  return (
    <AuthLayout focusTitle title={labels.deletionPendingTitle}>
      <div className={styles.stack}>
        <Alert tone="warning">{labels.deletionPendingBody(date)}</Alert>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <div className={styles.row}>
          <Button loading={busy} loadingLabel={labels.submitting} onClick={() => void cancel()}>
            {labels.deletionCancelAction}
          </Button>
          {leave(labels.deletionLeaveAction)}
        </div>
      </div>
    </AuthLayout>
  )
}
