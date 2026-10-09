import { formatInstant } from '@skeleton/time'
import { Button, Card } from '@skeleton/ui'
import { useId } from 'react'
import { cardDisplay, formatMoney, lookup } from './format'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { OpenRefundStatus, Order, Refund } from './ledgerTypes'
import { OrderStatusBadge, RefundStatusBadge } from './OrderStatusBadge'
import { TestModeNotice } from './TestModeNotice'
import styles from './OrderSummary.module.css'

export type OrderSummaryProps = {
  order: Order
  refunds: readonly Refund[]
  /** 주면 「환불 요청」 단추가 생긴다(환불할 수 있는 결제일 때). 대화상자를 여는 것은 부모 */
  onRequestRefund?: () => void
  /**
   * 서버 설정(`GET /config` 의 `refundRequestsEnabled`). 아직 모르면(설정을 불러오는 중) **비워 둔다** — 그동안은 단추를 그리지 않는다
   * (켜졌다 꺼지는 단추가 없다). `false` 면 단추가 흐려지고 이유가 옆에 보인다.
   */
  refundRequestsEnabled?: boolean
  /**
   * 화면이 낡았을 수 있다(다시 읽기가 실패했다) - 방금 낸 환불 요청이 안 보일 수 있어 「환불 요청」이 같은 방식(`aria-disabled` + 이유)으로 막힌다.
   * 열린 요청이 있다는 이유가 더 정확하면 그 이유가 먼저다
   */
  stale?: boolean
  /** 주면 내가 요청한(`REQUESTED` · `origin: 'USER'`) 환불 줄 옆에 「요청 거두기」 단추가 생긴다. 호출은 부모(`useWithdrawRefund`) */
  onWithdrawRefund?: (refund: Refund) => void
  /** 거두는 중 — 「요청 거두기」 단추가 잠기고 스피너 */
  withdrawing?: boolean
  locale?: string
  formatTime?: (iso: string) => string
  labels?: PaymentLabelsInput
}

const REFUNDABLE = new Set(['PAID', 'PARTIALLY_REFUNDED'])
const OPEN_REFUND = new Set(['REQUESTED', 'PENDING'])

/**
 * 결제 한 건 — `orderName` 그대로 · 상태 · 금액 · 결제 수단 · 시각 · 환불 줄 · 「환불 요청」 · 내 요청이면 「요청 거두기」.
 * 못 누르는 「환불 요청」(이미 요청함 · 환불 중 · 서버가 꺼 둠)은 `aria-disabled` 로 흐리게 두고 이유를 옆에 글자로 적는다 —
 * 꺼진(`disabled`) 단추와 달리 Tab 으로 닿고 이유가 단추 설명으로 낭독되며, 눌러도 아무 일도 없다. 계정 id 같은 내부 값은 그리지 않는다.
 */
export function OrderSummary({
  order,
  refunds,
  onRequestRefund,
  refundRequestsEnabled,
  stale,
  onWithdrawRefund,
  withdrawing,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  labels: input,
}: OrderSummaryProps) {
  const labels = resolvePaymentLabels(input)
  const reasonId = useId()
  const money = (amount: number) =>
    formatMoney(
      { amount, currency: order.amount.currency },
      { locale, currencySuffix: labels.currencySuffix },
    )
  const card = cardDisplay(order, labels)

  // 열린 환불의 상태: 환불 줄이 말해 주면 그것이(같은 카드의 머리 알약과 줄이 어긋나지 않게), 아니면 주문 응답이
  const openLine = refunds.find((refund) => OPEN_REFUND.has(refund.status))
  const open: OpenRefundStatus | null =
    (openLine?.status as OpenRefundStatus | undefined) ?? order.openRefundStatus

  const canRequest =
    Boolean(onRequestRefund) &&
    refundRequestsEnabled !== undefined &&
    REFUNDABLE.has(order.status) &&
    order.refundableAmount > 0
  const blocked =
    open === 'REQUESTED'
      ? labels.refundBlocked.requested
      : open === 'PENDING'
        ? labels.refundBlocked.inProgress
        : stale
          ? labels.refundBlocked.stale
          : refundRequestsEnabled === false
            ? labels.refundBlocked.unavailable
            : null

  return (
    <Card
      title={order.orderName}
      actions={<OrderStatusBadge status={order.status} openRefundStatus={open} labels={input} />}
    >
      <div className={styles.body}>
        {order.testMode && <TestModeNotice labels={input} />}
        <dl className={styles.facts}>
          <Fact label={labels.summary.amount}>{money(order.amount.amount)}</Fact>
          {card && <Fact label={labels.summary.method}>{card}</Fact>}
          {order.paidAt && <Fact label={labels.summary.paidAt}>{formatTime(order.paidAt)}</Fact>}
          {order.refundedAmount > 0 && (
            <Fact label={labels.summary.refunded}>{money(order.refundedAmount)}</Fact>
          )}
          {order.refundableAmount > 0 && REFUNDABLE.has(order.status) && (
            <Fact label={labels.summary.refundable}>{money(order.refundableAmount)}</Fact>
          )}
        </dl>
        {refunds.length > 0 && (
          <section aria-label={labels.summary.refunds}>
            <h3 className={styles.heading}>{labels.summary.refunds}</h3>
            <ul className={styles.refunds}>
              {refunds.map((refund) => {
                const reason = lookup(labels.refundReason, refund.reasonCode)
                // 끝난 줄은 끝난 때, 열린 줄은 요청한 때
                const when = refund.completedAt ?? refund.requestedAt
                return (
                  <li key={refund.id} className={styles.refund}>
                    <RefundStatusBadge
                      status={refund.status}
                      closedBy={refund.closedBy}
                      labels={input}
                    />
                    <strong>{money(refund.amount.amount)}</strong>
                    <span className={styles.refundMeta}>
                      {formatTime(when)}
                      {reason && ` · ${reason}`}
                    </span>
                    {onWithdrawRefund &&
                      refund.status === 'REQUESTED' &&
                      refund.origin === 'USER' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={withdrawing}
                          loadingLabel={labels.summary.withdrawing}
                          onClick={() => onWithdrawRefund(refund)}
                        >
                          {labels.summary.withdrawRefund}
                        </Button>
                      )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        {canRequest && (
          <div className={styles.action}>
            <Button
              variant="primary"
              aria-disabled={blocked !== null ? true : undefined}
              aria-describedby={blocked ? reasonId : undefined}
              onClick={blocked !== null ? undefined : onRequestRefund}
            >
              {labels.summary.requestRefund}
            </Button>
            {blocked && (
              <span id={reasonId} className={styles.reason}>
                {blocked}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function Fact({ label, children }: { label: string; children: string }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
