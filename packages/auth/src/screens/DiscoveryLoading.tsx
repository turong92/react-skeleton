import { Skeleton } from '@skeleton/ui'
import { AuthLayout } from './AuthLayout'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'

/** 백엔드에 로그인 방법을 묻는 동안 — 환경변수 기본값을 잠깐 보여 주지 않는다(틀린 버튼이 깜박이지 않게) */
export function DiscoveryLoading({
  title,
  labels: given,
}: {
  title?: string
  labels?: Partial<AuthLabels>
}) {
  const labels = mergeLabels(given)
  return (
    <AuthLayout title={title ?? labels.signInTitle}>
      <div className={styles.stack} role="status" aria-busy="true">
        <span className={styles.srOnly}>{labels.methodsLoading}</span>
        <Skeleton />
      </div>
    </AuthLayout>
  )
}
