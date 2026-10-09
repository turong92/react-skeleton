import { Alert, ConfirmDialog, ErrorReference, Field, Select } from '@skeleton/ui'
import { useId, useState } from 'react'
import { PaymentLedgerErrorCodes, isPaymentLedgerError } from './errors'
import { RefundRequestNotOpenError } from './queries'
import { referenceOf } from './failure'
import { formatMoney } from './format'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { Order, RefundRequestInput, RefundRequestReason } from './ledgerTypes'
import styles from './RefundRequestDialog.module.css'

/** 서버가 받는 사유 셋 — 그 밖의 말은 받지 않는다(자유 문장 없음) */
const REASONS: readonly RefundRequestReason[] = ['CUSTOMER_REQUEST', 'DUPLICATE', 'NOT_DELIVERED']

export type RefundRequestDialogProps = {
  open: boolean
  /** 닫기 · × · Esc — 열림 상태는 부모가 쥔다 */
  onClose: () => void
  /**
   * 「환불 요청하기」 — 환불할 수 있는 금액 전부를, **창이 보인 그 금액을 `amount` 로** 요청한다(그 사이 금액이 바뀌었으면 서버가 거절한다 —
   * 본 것과 요청한 것이 같다). 닫는 것은 부모. 열 때마다 묵은 오류가 보이지 않게 부모가 `request.reset()` 을 부른다(`open` 이 되는 때)
   */
  onConfirm: (input: RefundRequestInput & { amount: number }) => void
  /** `openRefundStatus` 는 선택 - 있으면 409 `REFUND_IN_PROGRESS` 가 「이미 요청함」인지 「환불 중」인지 가른다 */
  order: Pick<Order, 'amount' | 'refundableAmount'> & Partial<Pick<Order, 'openRefundStatus'>>
  /** 보내는 중 — 두 단추가 잠기고 확인에 스피너 */
  busy?: boolean
  /** 요청이 실패했을 때의 오류 — 알려진 환불 오류는 이유를, 그 밖은 일반 문구와 참조 번호를 보인다 */
  error?: unknown
  locale?: string
  labels?: PaymentLabelsInput
}

/** 환불 요청 확인 창 — 금액을 미리 보이고, 사유를 고르고(`CUSTOMER_REQUEST` · `DUPLICATE` · `NOT_DELIVERED`), 「환불 요청하기」/「닫기」 */
export function RefundRequestDialog({
  open,
  onClose,
  onConfirm,
  order,
  busy,
  error,
  locale,
  labels: input,
}: RefundRequestDialogProps) {
  const labels = resolvePaymentLabels(input)
  const reasonId = useId()
  const [reason, setReason] = useState<RefundRequestReason>('CUSTOMER_REQUEST')
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    // 열 때마다 처음 사유로 돌아온다
    setWasOpen(open)
    if (open) setReason('CUSTOMER_REQUEST')
  }
  const amount = formatMoney(
    { amount: order.refundableAmount, currency: order.amount.currency },
    { locale, currencySuffix: labels.currencySuffix },
  )
  const inProgress = isPaymentLedgerError(error, PaymentLedgerErrorCodes.REFUND_IN_PROGRESS)
  const notAllowed = isPaymentLedgerError(error, PaymentLedgerErrorCodes.REFUND_NOT_ALLOWED)
  const message = inProgress
    ? order.openRefundStatus === 'REQUESTED'
      ? labels.refundBlocked.requested
      : labels.refundBlocked.inProgress
    : notAllowed
      ? labels.refundBlocked.unavailable
      : // 든 키로 다시 보냈더니 줄이 이미 닫혀 있다 - 키가 놓였으니 다시 누르면 새 요청이다(막지 않는다)
        error instanceof RefundRequestNotOpenError
        ? labels.refundDialog.errors.closed
        : labels.refundDialog.errors.other
  const reference = error ? referenceOf(error) : undefined
  const nothingToRefund = order.refundableAmount <= 0
  // 서버가 「이미 환불 중」 · 「지금은 안 됨」 이라고 답한 뒤에는 다시 눌러도 같은 답이다 — 닫고 다시 열 때까지 막아 둔다.
  // 꺼(`disabled`) 두지 않는다: 확인은 `aria-disabled` 로 닿고, 이유 문장(아래 띠)이 단추 설명으로 낭독된다
  const blocked = nothingToRefund || inProgress || notAllowed

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => onConfirm({ reasonCode: reason, amount: order.refundableAmount })}
      title={labels.refundDialog.title}
      confirmLabel={labels.refundDialog.confirm}
      cancelLabel={labels.refundDialog.dismiss}
      closeLabel={labels.refundDialog.close}
      loadingLabel={labels.refundDialog.loading}
      tone="primary"
      busy={busy}
      confirmBlockedBy={blocked ? reasonId : undefined}
      description={
        <div className={styles.body}>
          <p className={styles.amount}>
            <span>{labels.refundDialog.amountLabel}</span>
            <span className={styles.amountValue}>{amount}</span>
          </p>
          <Field label={labels.refundDialog.reason}>
            {(control) => (
              <Select
                {...control}
                value={reason}
                onChange={(event) => setReason(event.target.value as RefundRequestReason)}
              >
                {REASONS.map((code) => (
                  <option key={code} value={code}>
                    {labels.refundReason[code]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <p className={styles.note}>{labels.refundDialog.note}</p>
          {nothingToRefund && (
            <div id={reasonId}>
              <Alert tone="info" toneLabel={labels.noticeLabel}>
                {labels.refundDialog.nothingToRefund}
              </Alert>
            </div>
          )}
          {error !== undefined && error !== null && (
            <>
              <div id={!nothingToRefund && (inProgress || notAllowed) ? reasonId : undefined}>
                <Alert tone="danger" toneLabel={labels.errorLabel}>
                  {message}
                </Alert>
              </div>
              {reference && (
                <ErrorReference
                  reference={reference}
                  label={labels.reference.label}
                  copyLabel={labels.reference.copy}
                  copiedLabel={labels.reference.copied}
                />
              )}
            </>
          )}
        </div>
      }
    />
  )
}
