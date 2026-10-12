import { Alert } from '@skeleton/ui'
import { formatMoney } from './format'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { CancelNowResult } from './subscriptionTypes'

export type CancelNowResultNoticeProps = {
  /** 「지금 해지하고 환불」 호출의 결과(`useCancelSubscriptionNow` 의 `data`) */
  result: CancelNowResult
  locale?: string
  labels?: PaymentLabelsInput
}

/**
 * 지금 해지한 직후의 안내 띠 - 얼마를 돌려주는지, 환불을 처리하는 중인지, 환불이 안 됐는지를 말한다.
 * 환불이 하나라도 결제사에 거절당했으면 경고(`FAILED`), 아직 보내는 중이면 안내, 모두 끝났으면 돌려줄 금액.
 */
export function CancelNowResultNotice({
  result,
  locale,
  labels: input,
}: CancelNowResultNoticeProps) {
  const all = resolvePaymentLabels(input)
  const labels = all.subscription.cancelNowResult
  const failed = result.refunds.some((refund) => refund.status === 'FAILED')
  const settling = result.refunds.some(
    (refund) => refund.status === 'PENDING' || refund.status === 'NOT_SENT',
  )
  if (failed)
    return (
      <Alert tone="warning" toneLabel={all.noticeLabel}>
        {labels.failed}
      </Alert>
    )
  if (settling)
    return (
      <Alert tone="info" toneLabel={all.noticeLabel}>
        {labels.pending}
      </Alert>
    )
  return (
    <Alert tone="success" toneLabel={all.noticeLabel}>
      {result.refund.amount > 0
        ? labels.done(formatMoney(result.refund, { locale, currencySuffix: all.currencySuffix }))
        : labels.noRefund}
    </Alert>
  )
}
