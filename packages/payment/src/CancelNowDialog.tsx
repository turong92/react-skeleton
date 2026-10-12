import { Alert, ConfirmDialog, ErrorReference } from '@skeleton/ui'
import { useId } from 'react'
import { PaymentLedgerErrorCodes, isPaymentLedgerError } from './errors'
import { referenceOf } from './failure'
import { formatMoney } from './format'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { CancelPreview } from './subscriptionTypes'
import styles from './CancelNowDialog.module.css'

export type CancelNowDialogProps = {
  open: boolean
  /** 닫기 · × · Esc - 열림 상태는 부모가 쥔다 */
  onClose: () => void
  /** 「지금 해지하고 환불받기」 - 호출과 닫는 것은 부모 */
  onConfirm: () => void
  /** 환불 미리보기 - 없으면(읽는 중 · 실패) 확인이 잠긴다. 금액은 시간에 따라 변하므로 창을 열 때 새로 읽은 값을 넘긴다 */
  preview?: CancelPreview | undefined
  previewLoading?: boolean
  previewError?: unknown
  /** 보내는 중 - 두 단추가 잠기고 확인에 스피너 */
  busy?: boolean
  /** 해지가 실패했을 때의 오류 - 알려진 오류는 이유를, 그 밖은 일반 문구와 참조 번호를 보인다 */
  error?: unknown
  locale?: string
  labels?: PaymentLabelsInput
}

/**
 * 지금 해지하고 환불받기 확인 창 - **환불 예정 금액과 계산 내역**(낸 금액 - 이용한 만큼 - 위약금)을 보이고, 철회 기간 안이면 전액이라고 말한다.
 * 금액을 읽기 전에는 확인이 잠긴다. 처음 포커스는 「닫기」.
 */
export function CancelNowDialog({
  open,
  onClose,
  onConfirm,
  preview,
  previewLoading,
  previewError,
  busy,
  error,
  locale,
  labels: input,
}: CancelNowDialogProps) {
  const all = resolvePaymentLabels(input)
  const labels = all.subscription.cancelNowDialog
  const statusId = useId()
  const ready = preview !== undefined && !previewLoading
  const message = isPaymentLedgerError(
    error,
    PaymentLedgerErrorCodes.SUBSCRIPTION_CANCEL_NOT_ALLOWED,
  )
    ? labels.errors.notAllowed
    : isPaymentLedgerError(error, PaymentLedgerErrorCodes.SUBSCRIPTION_CHARGE_IN_PROGRESS)
      ? labels.errors.chargeInProgress
      : labels.errors.other
  const reference = error ? referenceOf(error) : undefined
  const money = (amount: { amount: number; currency: string }) =>
    formatMoney(amount, { locale, currencySuffix: all.currencySuffix })
  const lineLabel = { PAID: labels.paid, USED: labels.used, PENALTY: labels.penalty }

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
      confirmBlockedBy={ready ? undefined : statusId}
      description={
        <div className={styles.body}>
          <p className={styles.text}>{labels.body}</p>
          {ready ? (
            <>
              <dl className={styles.breakdown} aria-label={labels.breakdown}>
                {preview.lines.map((line) => (
                  <div key={line.code} className={styles.line}>
                    <dt>{lineLabel[line.code]}</dt>
                    <dd>
                      {line.amount < 0
                        ? `-${money({ amount: -line.amount, currency: preview.refund.currency })}`
                        : money({ amount: line.amount, currency: preview.refund.currency })}
                    </dd>
                  </div>
                ))}
                <div className={`${styles.line} ${styles.total}`}>
                  <dt>{labels.refund}</dt>
                  <dd>{money(preview.refund)}</dd>
                </div>
              </dl>
              {preview.withdrawal && <p className={styles.note}>{labels.withdrawal}</p>}
              {preview.refund.amount === 0 && <p className={styles.note}>{labels.noRefund}</p>}
              <p className={styles.note}>{labels.estimate}</p>
            </>
          ) : (
            <p id={statusId} className={styles.note}>
              {previewError ? labels.previewError : labels.loadingPreview}
            </p>
          )}
          {error !== undefined && error !== null && (
            <>
              <Alert tone="danger" toneLabel={all.errorLabel}>
                {message}
              </Alert>
              {reference && (
                <ErrorReference
                  reference={reference}
                  label={all.reference.label}
                  copyLabel={all.reference.copy}
                  copiedLabel={all.reference.copied}
                />
              )}
            </>
          )}
        </div>
      }
    />
  )
}
