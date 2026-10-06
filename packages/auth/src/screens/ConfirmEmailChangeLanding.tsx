import { Alert } from '@skeleton/ui'
import { Link } from 'react-router-dom'
import { TokenLanding } from './TokenLanding'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'

export type ConfirmEmailChangeLandingProps = {
  token: string | null
  onConfirm: (token: string) => Promise<unknown>
  signInTo: string
  labels?: Partial<AuthLabels>
}

/** `/confirm-email-change?token=` — 새 주소의 메일 링크. 바뀌면 다른 기기는 로그아웃된다 */
export function ConfirmEmailChangeLanding({
  token,
  onConfirm,
  signInTo,
  labels: given,
}: ConfirmEmailChangeLandingProps) {
  const labels = mergeLabels(given)
  return (
    <TokenLanding
      token={token}
      run={onConfirm}
      labels={given}
      title={labels.confirmEmailChangeTitle}
      checking={labels.confirmEmailChangeChecking}
      done={
        <>
          <Alert tone="success">{labels.confirmEmailChangeDone}</Alert>
          <Link className={styles.link} to={signInTo}>
            {labels.verifyEmailDoneAction}
          </Link>
        </>
      }
      invalidTitle={labels.verifyEmailInvalidTitle}
      invalidBody={labels.confirmEmailChangeInvalidBody}
    />
  )
}
