import { Alert, Button } from '@skeleton/ui'
import { useState } from 'react'
import { AuthLayout } from './AuthLayout'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'

export type WebHandoffSwitchConfirmProps = {
  /** 지금 계정에서 나가고 앱의 계정으로 계속한다(`auth.logout()` 뒤 코드 교환은 문지기가) */
  onContinue: () => Promise<unknown>
  /** 코드를 버리고 지금 화면을 그대로 쓴다 */
  onCancel: () => void
  labels?: Partial<AuthLabels>
}

/** 이미 로그인한 브라우저에 앱의 코드가 왔다 - 묻지 않고 계정을 바꾸지 않는다(남이 만든 코드 링크로 내 브라우저가 그 사람 계정이 되는 일을 막는다) */
export function WebHandoffSwitchConfirm({
  onContinue,
  onCancel,
  labels: given,
}: WebHandoffSwitchConfirmProps) {
  const labels = mergeLabels(given)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  async function proceed() {
    setBusy(true)
    setFailed(false)
    try {
      await onContinue()
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }
  return (
    <AuthLayout title={labels.webHandoffSwitchTitle}>
      <div className={styles.stack}>
        <p>{labels.webHandoffSwitchBody}</p>
        {failed && <Alert tone="danger">{labels.errorGeneric}</Alert>}
        <div className={styles.row}>
          <Button onClick={proceed} disabled={busy}>
            {labels.webHandoffSwitchContinue}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {labels.webHandoffSwitchCancel}
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}
