import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { Alert, Button, Spinner } from '@skeleton/ui'
import { Link } from 'react-router-dom'
import { deletionPendingOf } from '../pendingDeletion'
import { SocialLoginCallbackError } from '../social'
import type { SocialCallbackState } from '../useSocialLoginCallback'
import { AuthLayout } from './AuthLayout'
import { DeletionPendingScreen } from './DeletionPendingScreen'
import styles from './auth.module.css'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'

export type SocialCallbackScreenProps = {
  /** `useSocialLoginCallback(flow, search)` 의 상태 — 성공 뒤 이동은 호출자가 */
  state: SocialCallbackState
  signInTo: string
  /** 있으면 오류 화면에 「다시 시도」(발견에 실패했을 때 방법을 다시 묻는다) */
  onRetry?: () => void
  /** 탈퇴 대기 중인 계정의 로그인(`403 AUTH.ACCOUNT_DELETION_PENDING`)에서 「탈퇴 취소」 — 토큰으로 취소하고 로그인한 뒤 이동은 호출자가. 안 주면 안내만 */
  onCancelDeletion?: (restoreToken: string) => Promise<unknown>
  /** 삭제 예정일 표기 */
  formatDate?: (iso: string) => string
  labels?: Partial<AuthLabels>
}

/** 백엔드 코드가 정확히 말해 주는 실패는 그 문구, 그 밖에는 일반 「로그인을 마치지 못했어요」 */
function known(error: unknown, labels: AuthLabels): string {
  const { message } = authErrorMessage(error, labels)
  return message === labels.errorGeneric ? labels.callbackFailedBody : message
}

/** `/auth/callback` — 제공자가 돌려보낸 뒤: 마무리 중 · 실패 · 이미 같은 이메일의 계정이 있음(자동 합치지 않는다) */
export function SocialCallbackScreen({
  state,
  signInTo,
  onRetry,
  onCancelDeletion,
  formatDate,
  labels: given,
}: SocialCallbackScreenProps) {
  const labels = mergeLabels(given)
  const pendingDeletion = state.status === 'error' ? deletionPendingOf(state.error) : null
  if (pendingDeletion)
    return (
      <DeletionPendingScreen
        pending={pendingDeletion}
        onCancel={onCancelDeletion}
        leaveTo={signInTo}
        formatDate={formatDate}
        labels={given}
      />
    )
  if (state.status === 'error') {
    const conflict = isErrorCode(state.error, ErrorCodes.ACCOUNT_SOCIAL_EMAIL_CONFLICT)
    const callbackError = state.error instanceof SocialLoginCallbackError ? state.error : undefined
    // 사용자가 제공자 화면에서 취소했다 — 실패가 아니다
    const cancelled =
      callbackError?.reason === 'provider_error' && callbackError.providerError === 'access_denied'
    const title = conflict
      ? labels.callbackConflictTitle
      : cancelled
        ? labels.callbackCancelledTitle
        : labels.callbackFailedTitle
    const body = conflict
      ? labels.callbackConflictBody
      : cancelled
        ? labels.callbackCancelledBody
        : callbackError?.reason === 'state_mismatch'
          ? labels.callbackStateBody
          : callbackError
            ? labels.callbackFailedBody
            : known(state.error, labels)
    return (
      <AuthLayout title={title}>
        <div className={styles.stack}>
          <Alert tone={conflict ? 'warning' : cancelled ? 'info' : 'danger'}>{body}</Alert>
          {onRetry && (
            <div>
              <Button variant="secondary" size="sm" onClick={onRetry}>
                {labels.methodsRetry}
              </Button>
            </div>
          )}
          <Link className={styles.link} to={signInTo}>
            {labels.backToSignIn}
          </Link>
        </div>
      </AuthLayout>
    )
  }
  return (
    <AuthLayout title={labels.signInTitle}>
      <div className={styles.row} aria-live="polite">
        <Spinner label={labels.callbackChecking} />
        <span>{labels.callbackChecking}</span>
      </div>
    </AuthLayout>
  )
}
