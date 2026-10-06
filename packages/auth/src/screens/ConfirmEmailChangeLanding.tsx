import { Alert } from '@skeleton/ui'
import { Link } from 'react-router-dom'
import { TokenLanding } from './TokenLanding'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'

export type ConfirmEmailChangeLandingProps = {
  token: string | null
  onConfirm: (token: string) => Promise<unknown>
  signInTo: string
  /** 기본 true — 「계속」을 눌러야 확정한다(메일 스캐너 방어) */
  requireConfirm?: boolean
  labels?: Partial<AuthLabels>
}

/** `/confirm-email-change?token=` — 새 주소의 메일 링크. 바뀌면 다른 기기는 로그아웃된다 */
export function ConfirmEmailChangeLanding({
  token,
  onConfirm,
  signInTo,
  requireConfirm = true,
  labels: given,
}: ConfirmEmailChangeLandingProps) {
  const labels = mergeLabels(given)
  return (
    <TokenLanding
      token={token}
      run={onConfirm}
      requireConfirm={requireConfirm}
      confirmPrompt={labels.confirmEmailChangePrompt}
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
