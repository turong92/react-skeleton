import { Alert, Checkbox, ConfirmDialog, ErrorReference } from '@skeleton/ui'
import { useState } from 'react'
import { PaymentLedgerErrorCodes, isPaymentLedgerError } from '../errors'
import { referenceOf } from '../failure'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import styles from './CloseSubscriptionChargeDialog.module.css'

export type CloseSubscriptionChargeDialogProps = {
  open: boolean
  /** 닫기 · × · Esc - 열림 상태는 부모가 쥔다 */
  onClose: () => void
  /** 「결제 안 됨으로 닫기」 - 호출과 닫는 것은 부모. 인자는 운영자가 결제사 화면에서 직접 확인했다는 표시다(주문 번호로 물을 수 없는 결제사의 키 없는 주문에서만 켜진다) */
  onConfirm: (confirmedAtProvider: boolean) => void
  /** 보내는 중 - 두 단추가 잠기고 확인에 스피너 */
  busy?: boolean
  /** 닫기가 실패했을 때의 오류 - 닫을 수 없는 결제(409)는 그 말을, 그 밖은 일반 문구와 참조 번호를 보인다 */
  error?: unknown
  labels?: PaymentLabelsInput
}

/**
 * 막힌 구독 결제(결제사가 끝내 답하지 않아 확인 중으로 남은 것)를 「결제 안 됨」으로 닫는 확인 창. 서버가 닫기 전에 결제사에 한 번 더 묻고 결제된 것으로 나오면 닫지 않는다 -
 * 그 사실을 본문이 먼저 말한다. 처음 포커스는 「닫기」(실수로 Enter 를 눌러도 안전).
 */
export function CloseSubscriptionChargeDialog({
  open,
  onClose,
  onConfirm,
  busy,
  error,
  labels: input,
}: CloseSubscriptionChargeDialogProps) {
  const all = resolvePaymentLabels(input)
  const text = all.admin.closeChargeDialog
  const hasError = error !== undefined && error !== null
  const reference = hasError ? referenceOf(error) : undefined
  // 서버가 「직접 확인 없이는 닫지 않는다」고 하면 확인 칸을 받아 다시 보낸다
  const needsConfirmation =
    hasError && isPaymentLedgerError(error, PaymentLedgerErrorCodes.ORDER_CLOSE_NEEDS_CONFIRMATION)
  const [confirmed, setConfirmed] = useState(false)
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => onConfirm(needsConfirmation && confirmed)}
      confirmDisabled={needsConfirmation && !confirmed}
      title={text.title}
      confirmLabel={text.confirm}
      cancelLabel={text.dismiss}
      closeLabel={text.close}
      loadingLabel={text.loading}
      busy={busy}
      description={
        <div className={styles.body}>
          <p className={styles.text}>{text.body}</p>
          {needsConfirmation && (
            <Checkbox
              label={text.confirmedAtProvider}
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
          )}
          {hasError && (
            <>
              <Alert tone="danger" toneLabel={all.errorLabel}>
                {needsConfirmation
                  ? text.errors.needsConfirmation
                  : isPaymentLedgerError(error, PaymentLedgerErrorCodes.ORDER_NOT_CLOSABLE)
                    ? text.errors.notClosable
                    : text.errors.other}
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
