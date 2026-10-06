import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { Alert, Spinner } from '@skeleton/ui'
import { Link } from 'react-router-dom'
import type { SocialCallbackState } from '../useSocialLoginCallback'
import { AuthLayout } from './AuthLayout'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'

export type SocialCallbackScreenProps = {
  /** `useSocialLoginCallback(flow, search)` 의 상태 — 성공 뒤 이동은 호출자가 */
  state: SocialCallbackState
  signInTo: string
  labels?: Partial<AuthLabels>
}

/** `/auth/callback` — 제공자가 돌려보낸 뒤: 마무리 중 · 실패 · 이미 같은 이메일의 계정이 있음(자동 합치지 않는다) */
export function SocialCallbackScreen({
  state,
  signInTo,
  labels: given,
}: SocialCallbackScreenProps) {
  const labels = mergeLabels(given)
  if (state.status === 'error') {
    const conflict = isErrorCode(state.error, ErrorCodes.ACCOUNT_SOCIAL_EMAIL_CONFLICT)
    return (
      <AuthLayout title={conflict ? labels.callbackConflictTitle : labels.callbackFailedTitle}>
        <div className={styles.stack}>
          <Alert tone={conflict ? 'warning' : 'danger'}>
            {conflict ? labels.callbackConflictBody : labels.callbackFailedBody}
          </Alert>
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
