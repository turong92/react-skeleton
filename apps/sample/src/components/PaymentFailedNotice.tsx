import type { PaymentLabels } from '@skeleton/payment'
import { Alert, ErrorReference } from '@skeleton/ui'
import type { ReactNode } from 'react'
import styles from './PaymentFailedNotice.module.css'

/**
 * 결제 화면의 동작(요청 거두기 …)이 안 됐을 때 제자리에서 말하는 띠 — 우리 문장(`children`)과 문의 번호만 보인다.
 * 서버의 `title`/`detail` 은 영어일 수 있어 보이지 않는다(`toastUnlessValidation` 이 `PAYMENT.*` 를 토스트에서 뺀다).
 */
export function PaymentFailedNotice({
  error,
  labels,
  children,
}: {
  error: unknown
  labels: Pick<PaymentLabels, 'errorLabel' | 'reference'>
  children: ReactNode
}) {
  return (
    <Alert tone="danger" toneLabel={labels.errorLabel}>
      {children}
      <div className={styles.reference}>
        <ErrorReference
          error={error}
          label={labels.reference.label}
          copyLabel={labels.reference.copy}
          copiedLabel={labels.reference.copied}
        />
      </div>
    </Alert>
  )
}
