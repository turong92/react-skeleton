import { formatInstant } from '@skeleton/time'
import { Alert, ConfirmDialog, ErrorReference } from '@skeleton/ui'
import { referenceOf } from './failure'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { ScheduledChange } from './subscriptionTypes'
import styles from './CancelSubscriptionDialog.module.css'

export type CancelScheduledChangeDialogProps = {
  open: boolean
  /** 닫기 · × · Esc - 열림 상태는 부모가 쥔다 */
  onClose: () => void
  /** 「예약 거두기」 - 호출과 닫는 것은 부모 */
  onConfirm: () => void
  scheduledChange: Pick<ScheduledChange, 'planName' | 'effectiveAt'>
  /** 보내는 중 - 두 단추가 잠기고 확인에 스피너 */
  busy?: boolean
  /** 거두기가 실패했을 때의 오류 - 일반 문구와 참조 번호를 보인다 */
  error?: unknown
  locale?: string
  formatTime?: (iso: string) => string
  labels?: PaymentLabelsInput
}

/** 예약된 플랜 변경을 거두는 확인 창 - 어느 플랜으로 언제 바뀔 예정이었는지, 거두면 지금 플랜 그대로라고 먼저 말한다. 처음 포커스는 「닫기」 */
export function CancelScheduledChangeDialog({
  open,
  onClose,
  onConfirm,
  scheduledChange,
  busy,
  error,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  labels: input,
}: CancelScheduledChangeDialogProps) {
  const common = resolvePaymentLabels(input)
  const labels = common.subscription.cancelScheduleDialog
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
      tone="primary"
      busy={busy}
      description={
        <div className={styles.body}>
          <p className={styles.text}>
            {labels.body(scheduledChange.planName, formatTime(scheduledChange.effectiveAt))}
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
