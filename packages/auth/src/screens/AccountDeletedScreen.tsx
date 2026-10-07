import { Alert } from '@skeleton/ui'
import { Link } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'

export type AccountDeletedScreenProps = {
  /** 삭제 예정일(ISO) — 새로고침으로 잃었으면 날짜 없는 문장 */
  purgeAfter?: string | null
  /** 서버가 self-restore 를 켰다 — 켠 서버에서만 「그 전에 다시 로그인하면 취소할 수 있어요」 */
  selfRestore?: boolean
  signInTo: string
  formatDate?: (iso: string) => string
  labels?: Partial<AuthLabels>
}

const defaultFormat = (iso: string) => new Date(iso).toLocaleDateString()

/**
 * 계정 삭제를 마친 직후 — 서버는 이미 모든 세션을 닫았고 이 기기의 로컬 세션도 지웠으므로 **보호되지 않은** 안내 화면이다
 * (머리글도 로그아웃 상태). 「탈퇴가 접수됐어요. {날짜}에 지워져요.」 + (self-restore 면) 취소 방법 + 로그인 화면으로.
 */
export function AccountDeletedScreen({
  purgeAfter,
  selfRestore = false,
  signInTo,
  formatDate = defaultFormat,
  labels: given,
}: AccountDeletedScreenProps) {
  const labels = mergeLabels(given)
  return (
    <AuthLayout title={labels.accountDeletedTitle}>
      <div className={styles.stack}>
        <Alert tone="warning">
          {labels.accountDeletedBody(purgeAfter ? formatDate(purgeAfter) : null)}
          {selfRestore && ` ${labels.accountDeletedRestoreNote}`}
        </Alert>
        <div>
          <Link className={styles.link} to={signInTo}>
            {labels.accountDeletedAction}
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}
