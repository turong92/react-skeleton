import { Link } from 'react-router-dom'
import { deletionPendingOf } from '../pendingDeletion'
import { DeletionPendingScreen } from './DeletionPendingScreen'
import type { OnceRunner } from './runOnce'
import { TokenLanding } from './TokenLanding'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'

export type MagicLinkLandingProps = {
  token: string | null
  /** 토큰을 로그인으로 바꾼다(`session.magicLinkLogin`) */
  onRedeem: (token: string) => Promise<unknown>
  /** 로그인되면(보통 원래 가려던 곳으로 이동) */
  onDone: () => void
  /** 새 링크를 요청하는 곳(로그인 화면) */
  requestTo: string
  /** 탈퇴 대기 중인 계정(`403 AUTH.ACCOUNT_DELETION_PENDING`)이 링크로 들어왔을 때 「탈퇴 취소」 — 토큰으로 취소하고 로그인한 뒤 이동은 호출자가. 안 주면 안내만 */
  onCancelDeletion?: (restoreToken: string) => Promise<unknown>
  /** 삭제 예정일 표기 */
  formatDate?: (iso: string) => string
  labels?: Partial<AuthLabels>
  /** 같은 링크를 화면이 다시 마운트돼도 한 번만 보내는 실행기(라우트 한 벌이 준다) */
  once?: OnceRunner
}

/** `/magic-link?token=` — 링크를 열면 로그인한다. 정지된 계정(403) 등은 일시 오류 줄로, 탈퇴 대기 중인 계정은 「탈퇴를 취소할까요?」로 보인다 */
export function MagicLinkLanding({
  token,
  onRedeem,
  onDone,
  requestTo,
  onCancelDeletion,
  formatDate,
  labels: given,
  once,
}: MagicLinkLandingProps) {
  const labels = mergeLabels(given)
  return (
    <TokenLanding
      token={token}
      once={once}
      onceKind="magic-link"
      run={onRedeem}
      onDone={onDone}
      renderFailure={(error) => {
        const pending = deletionPendingOf(error)
        return pending ? (
          <DeletionPendingScreen
            pending={pending}
            onCancel={onCancelDeletion}
            leaveTo={requestTo}
            formatDate={formatDate}
            labels={given}
          />
        ) : null
      }}
      labels={given}
      title={labels.magicLinkTitle}
      checking={labels.magicLinkChecking}
      done={<p>{labels.magicLinkChecking}</p>}
      invalidTitle={labels.magicLinkInvalidTitle}
      invalidBody={labels.magicLinkInvalidBody}
      invalid={
        <Link className={styles.link} to={requestTo}>
          {labels.magicLinkRequestNew}
        </Link>
      }
    />
  )
}
