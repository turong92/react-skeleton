import { formatInstant } from '@skeleton/time'
import { Alert, ConfirmDialog, ErrorReference } from '@skeleton/ui'
import { referenceOf } from './failure'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { Subscription } from './subscriptionTypes'
import styles from './CancelSubscriptionDialog.module.css'

export type CancelSubscriptionDialogProps = {
  open: boolean
  /** 닫기 · × · Esc — 열림 상태는 부모가 쥔다 */
  onClose: () => void
  /** 「해지 예약하기」 — 호출과 닫는 것은 부모 */
  onConfirm: () => void
  subscription: Pick<Subscription, 'status' | 'currentPeriodEnd'>
  /** 보내는 중 — 두 단추가 잠기고 확인에 스피너 */
  busy?: boolean
  /** 해지가 실패했을 때의 오류 — 일반 문구와 참조 번호를 보인다 */
  error?: unknown
  locale?: string
  formatTime?: (iso: string) => string
  labels?: PaymentLabelsInput
}

/** 해지 확인 창 — `ACTIVE` 는 「○○까지 이용하고 그 뒤 결제하지 않는다」, `PAST_DUE` 는 「바로 끝난다」. 처음 포커스는 「닫기」 */
export function CancelSubscriptionDialog({
  open,
  onClose,
  onConfirm,
  subscription,
  busy,
  error,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  labels: input,
}: CancelSubscriptionDialogProps) {
  const labels = resolvePaymentLabels(input).subscription.cancelDialog
  const common = resolvePaymentLabels(input)
  const reference = error ? referenceOf(error) : undefined
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={labels.title}
      confirmLabel={labels.confirm}
      cancelLabel={labels.dismiss}
      closeLabel={labels.close}
      loadingLabel={labels.loading}
      busy={busy}
      description={
        <div className={styles.body}>
          <p className={styles.text}>
            {subscription.status === 'PAST_DUE'
              ? labels.bodyNow
              : labels.body(formatTime(subscription.currentPeriodEnd))}
          </p>
          {error !== undefined && error !== null && (
            <>
              <Alert tone="danger" toneLabel={common.errorLabel}>
                {labels.error}
              </Alert>
              {reference && (
                <ErrorReference
                  reference={reference}
                  label={common.reference.label}
                  copyLabel={common.reference.copy}
                  copiedLabel={common.reference.copied}
                />
              )}
            </>
          )}
        </div>
      }
    />
  )
}
