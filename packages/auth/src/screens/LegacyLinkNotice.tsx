import { Link } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'

export type LegacyLinkNoticeProps = {
  signInTo: string
  labels?: Partial<AuthLabels>
}

/**
 * 오래된 메일의 링크(가입 인증 · 이메일 변경 확인 · 본인 확인 · 삭제 확인)가 닿는 자리 — 이제는 모두 6자리 인증번호라 링크로는 아무것도 하지 않는다.
 * 토큰은 읽지도 서버로 보내지도 않는다. 막다른 길(404)이 되지 않게 한 줄로 알려 주고 로그인으로 보낸다.
 */
export function LegacyLinkNotice({ signInTo, labels: given }: LegacyLinkNoticeProps) {
  const labels = mergeLabels(given)
  return (
    <AuthLayout title={labels.legacyLinkTitle}>
      <div className={styles.stack}>
        <p>{labels.legacyLinkBody}</p>
        <Link className={styles.link} to={signInTo}>
          {labels.legacyLinkAction}
        </Link>
      </div>
    </AuthLayout>
  )
}
