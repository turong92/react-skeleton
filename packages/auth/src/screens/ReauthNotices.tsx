import { Alert, Button } from '@skeleton/ui'
import type { ReauthStore } from '../reauth'
import styles from './auth.module.css'
import type { AuthLabels } from './labels'

/** 비밀번호 없는 계정의 다시 인증에 필요한 것 — 하려던 작업 · 토큰 보관(`ReauthStore`)과 확인 메일 요청 */
export type ReauthSupport = {
  store: ReauthStore
  /** `accountApi.requestReauthConfirmation` */
  requestMail: () => Promise<unknown>
}

export type ReauthNoticesProps = {
  /** 이 절이 다시 인증을 다루는가(비밀번호 없는 계정 + 지원이 꽂힘) */
  active: boolean
  /** 확인 메일을 방금 보냈다 */
  sent: boolean
  email: string | null
  /** 링크를 이미 열어 토큰이 보관되어 있다 — 한 번 더 제출하면 끝난다 */
  ready: boolean
  onResend: () => void
  resending?: boolean
  labels: AuthLabels
}

/** 다시 인증의 세 상태 — 안내(메일을 보낼 것이다) · 보냈다(확인하세요) · 확인했다(한 번 더 제출) */
export function ReauthNotices({
  active,
  sent,
  email,
  ready,
  onResend,
  resending,
  labels,
}: ReauthNoticesProps) {
  if (!active) return null
  return (
    <div className={styles.stack}>
      {ready ? (
        <Alert tone="success" title={labels.reauthReadyTitle}>
          {labels.reauthReadyBody}
        </Alert>
      ) : sent ? (
        <Alert
          tone="info"
          title={labels.reauthSentTitle}
          action={
            <Button
              variant="secondary"
              size="sm"
              loading={resending}
              loadingLabel={labels.submitting}
              onClick={onResend}
            >
              {labels.reauthResend}
            </Button>
          }
        >
          {labels.reauthSentBody(email ?? '')}
        </Alert>
      ) : (
        <p className={styles.muted}>{labels.reauthHint}</p>
      )}
    </div>
  )
}
