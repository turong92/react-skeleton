import { Alert } from '@skeleton/ui'
import { AuthLayout } from './AuthLayout'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'

export type AccountStateNoticeProps = {
  /** `suspended`: 계정 정지(`AUTH.ACCOUNT_SUSPENDED`) · `blocked`: 이 화면을 쓸 수 없음(403 `COMMON.FORBIDDEN`) */
  kind: 'suspended' | 'blocked'
  /** 있으면 「문의」 링크 */
  supportHref?: string
  labels?: Partial<AuthLabels>
}

/** 정지 · 차단 화면 — 로그아웃시키지 않고(403) 이유만 알린다 */
export function AccountStateNotice({ kind, supportHref, labels: given }: AccountStateNoticeProps) {
  const labels = mergeLabels(given)
  const suspended = kind === 'suspended'
  return (
    <AuthLayout title={suspended ? labels.suspendedTitle : labels.blockedTitle}>
      <Alert
        tone={suspended ? 'warning' : 'danger'}
        action={
          supportHref ? (
            <a className={styles.link} href={supportHref}>
              {labels.contactSupport}
            </a>
          ) : undefined
        }
      >
        {suspended ? labels.suspendedBody : labels.blockedBody}
      </Alert>
    </AuthLayout>
  )
}
