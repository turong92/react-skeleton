import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { Alert, Button, Spinner } from '@skeleton/ui'
import { Link, useNavigate } from 'react-router-dom'
import { deletionPendingOf } from '../pendingDeletion'
import { SocialLoginCallbackError } from '../social'
import type { SocialCallbackState } from '../useSocialLoginCallback'
import { AuthLayout } from './AuthLayout'
import { DeletionPendingScreen } from './DeletionPendingScreen'
import styles from './auth.module.css'
import { authErrorMessage } from './errors'
import { linkIntentState } from '../linkIntent'
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
  /**
   * 있으면 「같은 이메일의 계정이 이미 있다」(409)를 막다른 오류가 아니라 **안내 화면**으로 그린다 — 「로그인하러 가기」 · 「처음으로」(이 주소).
   * 소셜 로그인 콜백만 준다(계정 연결 콜백의 충돌은 뜻이 다르다)
   */
  homeTo?: string
  /** 안내 화면의 「로그인하러 가기」로 로그인에 성공하면 가는 곳 — 설정의 로그인 수단 구역(`{ pathname: '/account', hash: '#methods' }`). 어느 제공자를 연결하려 했는지는 router state 로만 따라간다 */
  linkTo?: { pathname: string; hash?: string }
  /** 거절된 로그인의 제공자 코드(`flow.providerOfFailure(error)`) — 안내 문장이 그 이름을 말한다 */
  provider?: string
  labels?: Partial<AuthLabels>
}

/** 백엔드 코드가 정확히 말해 주는 실패는 그 문구, 그 밖에는 일반 「로그인을 마치지 못했어요」 */
function known(error: unknown, labels: AuthLabels, provider?: string): string {
  const { message, code } = authErrorMessage(error, labels)
  // 다른 계정이 쥔 소셜 — 어느 제공자인지 알면 그 이름으로 출구(그 계정에서 끊기 · 삭제)를 말한다
  if (code === ErrorCodes.ACCOUNT_IDENTITY_TAKEN && provider)
    return labels.errorIdentityTakenFor(labels.providerNames[provider] ?? provider)
  return message === labels.errorGeneric ? labels.callbackFailedBody : message
}

/** `/auth/callback` — 제공자가 돌려보낸 뒤: 마무리 중 · 실패 · 이미 같은 이메일의 계정이 있음(자동 합치지 않는다) */
export function SocialCallbackScreen({
  state,
  signInTo,
  onRetry,
  onCancelDeletion,
  formatDate,
  homeTo,
  linkTo,
  provider,
  labels: given,
}: SocialCallbackScreenProps) {
  const labels = mergeLabels(given)
  const navigate = useNavigate()
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
    if (conflict && homeTo) {
      const name = provider
        ? (labels.providerNames[provider] ?? provider)
        : labels.callbackConflictUnknownProvider
      return (
        <AuthLayout focusTitle title={labels.callbackConflictTitle}>
          <div className={styles.stack}>
            <p>{labels.callbackConflictBody(name)}</p>
            <div className={styles.row}>
              <Button
                onClick={() =>
                  navigate(
                    signInTo,
                    linkTo ? { state: linkIntentState(provider, linkTo) } : undefined,
                  )
                }
              >
                {labels.callbackConflictSignIn}
              </Button>
              <Button variant="secondary" onClick={() => navigate(homeTo)}>
                {labels.callbackConflictHome}
              </Button>
            </div>
          </div>
        </AuthLayout>
      )
    }
    const title = conflict
      ? labels.callbackConflictTitle
      : cancelled
        ? labels.callbackCancelledTitle
        : labels.callbackFailedTitle
    const body = conflict
      ? labels.errorSocialConflict
      : cancelled
        ? labels.callbackCancelledBody
        : callbackError?.reason === 'state_mismatch'
          ? labels.callbackStateBody
          : callbackError
            ? labels.callbackFailedBody
            : known(state.error, labels, provider)
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
