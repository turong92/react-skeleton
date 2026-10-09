import { Badge, type BadgeProps } from '@skeleton/ui'
import { lookup } from './format'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { OpenRefundStatus, OrderStatus, Refund, RefundStatus } from './ledgerTypes'

type Tone = NonNullable<BadgeProps['tone']>

const ORDER_TONE: Record<OrderStatus, Tone> = {
  PENDING: 'neutral',
  CONFIRMING: 'info',
  PAID: 'success',
  PARTIALLY_REFUNDED: 'info',
  REFUNDED: 'neutral',
  FAILED: 'danger',
  EXPIRED: 'warning',
  CANCELED: 'neutral',
}

const REFUND_TONE: Record<RefundStatus, Tone> = {
  REQUESTED: 'info',
  PENDING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  REJECTED: 'danger',
  WITHDRAWN: 'neutral',
}

export type OrderStatusBadgeProps = {
  status: OrderStatus
  /** 주문 응답의 열린 환불 상태 — `REQUESTED` 「환불 요청함」(돈은 안 움직였다) · `PENDING` 「환불 중」. 결제된 주문일 때만 상태를 대신한다 */
  openRefundStatus?: OpenRefundStatus | null
  labels?: PaymentLabelsInput
}

/**
 * 결제 상태 알약 — 눌리지 않는다(단추도 링크도 아니다). 뜻은 글자로 전하고 색은 거든다.
 * 서버가 이 패키지보다 먼저 새 상태를 보내도 코드를 그리지 않는다 — 중립 글자(「확인 필요」).
 */
export function OrderStatusBadge({
  status,
  openRefundStatus,
  labels: input,
}: OrderStatusBadgeProps) {
  const labels = resolvePaymentLabels(input)
  if (openRefundStatus && (status === 'PAID' || status === 'PARTIALLY_REFUNDED'))
    return openRefundStatus === 'REQUESTED' ? (
      <Badge tone={REFUND_TONE.REQUESTED}>{labels.refundStatus.REQUESTED}</Badge>
    ) : (
      <Badge tone="warning">{labels.refundInProgress}</Badge>
    )
  const text = lookup(labels.orderStatus, status)
  return (
    <Badge tone={lookup(ORDER_TONE, status) ?? 'neutral'}>{text ?? labels.unknownStatus}</Badge>
  )
}

/** 환불 한 줄의 상태 알약(패키지 안에서만 쓴다) */
export function RefundStatusBadge({
  status,
  closedBy,
  labels: input,
}: {
  status: RefundStatus
  /** `WITHDRAWN` 줄을 누가 닫았나 - `SYSTEM`(환불이 끝나 요청이 닫혔다)이면 「요청 거둠」이 아니라 그 말을 한다. 없으면 본인이 거둔 것 */
  closedBy?: Refund['closedBy']
  labels?: PaymentLabelsInput
}) {
  const labels = resolvePaymentLabels(input)
  const text =
    status === 'WITHDRAWN' && closedBy === 'SYSTEM'
      ? labels.refundClosedBySystem
      : lookup(labels.refundStatus, status)
  return (
    <Badge tone={lookup(REFUND_TONE, status) ?? 'neutral'}>{text ?? labels.unknownStatus}</Badge>
  )
}
