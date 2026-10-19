import { formatInstant } from '@skeleton/time'
import { Button, Table, type TableColumn } from '@skeleton/ui'
import { useId } from 'react'
import { formatMoney, lookup, requestedAmountNote } from '../format'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import { RefundStatusBadge } from '../OrderStatusBadge'
import { closedByOf } from './closedBy'
import { ListFrame } from './ListFrame'
import { rowActionClass, type RenderRowAction } from './rowAction'
import sharedStyles from './shared.module.css'
import type { AdminRefund } from './types'

export type RefundRequestTableProps = {
  refunds: readonly AdminRefund[]
  /** 기다리는 요청 줄의 「요청대로 환불하기」 — 돈이 나가니 부모가 확인 창(`AdminRefundDialog`)을 연다 */
  onApprove?: (refund: AdminRefund) => void
  /** 기다리는 요청 줄의 「요청 거절하기」 */
  onReject?: (refund: AdminRefund) => void
  /** 줄 끝 「결제 보기」 단추. 라우터 링크를 쓰려면 `renderAction` */
  onOpenOrder?: (refund: AdminRefund) => void
  renderAction?: RenderRowAction<AdminRefund>
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  onLoadMore?: () => void
  loadingMore?: boolean
  locale?: string
  formatTime?: (iso: string) => string
  labels?: PaymentLabelsInput
}

/**
 * 환불 요청 목록 — 줄마다 결제 번호 · 금액 · 사유 · 요청한 때 · 상태 알약. 결정을 기다리는 줄(`REQUESTED`)에는 테두리 단추
 * 「요청대로 환불하기」 · 「요청 거절하기」 · 「결제 보기」 — 줄마다 채운 단추를 두면 스무 줄에 스무 개라, 채운 단추는 화면에 하나(확인 창의 확인)뿐이다.
 * 단추 이름에 금액과 결제 번호가 붙어 줄마다 구별된다. 보이기만 한다(결정은 부모가 확인 창을 거쳐 부른다).
 */
export function RefundRequestTable({
  refunds,
  onApprove,
  onReject,
  onOpenOrder,
  renderAction,
  loading,
  error,
  onRetry,
  onLoadMore,
  loadingMore,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  labels: input,
}: RefundRequestTableProps) {
  const labels = resolvePaymentLabels(input)
  const text = labels.admin.requests
  const panel = labels.admin.panel
  const money = (refund: AdminRefund) =>
    formatMoney(refund.amount, { locale, currencySuffix: labels.currencySuffix })
  const blockId = useId()
  // 서버가 이 결제사로는 환불을 못 보낸다고 알린 줄 - 「요청대로 환불하기」를 막고 이유를 옆에 적는다(거절은 그대로: 결제사 화면에서 환불한 뒤 요청을 거절한다)
  const blockOf = (refund: AdminRefund) =>
    refund.refundBlock
      ? (lookup(labels.admin.refundBlock, refund.refundBlock) ?? labels.admin.refundBlock.OTHER)
      : null

  const columns: TableColumn<AdminRefund>[] = [
    {
      key: 'payment',
      header: text.columns.payment,
      rowHeader: true,
      render: (refund) => <span className={sharedStyles.code}>{refund.orderId}</span>,
    },
    {
      key: 'amount',
      header: text.columns.amount,
      align: 'end',
      render: (refund) => {
        const note = requestedAmountNote(refund, labels, locale)
        return (
          <span className={sharedStyles.amount}>
            {money(refund)}
            {note && ` (${note})`}
          </span>
        )
      },
    },
    {
      key: 'reason',
      header: text.columns.reason,
      render: (refund) => lookup(labels.refundReason, refund.reasonCode) ?? null,
    },
    {
      key: 'requestedAt',
      header: text.columns.requestedAt,
      render: (refund) => formatTime(refund.requestedAt),
    },
    {
      key: 'status',
      header: text.columns.status,
      render: (refund) => (
        <RefundStatusBadge status={refund.status} closedBy={closedByOf(refund)} labels={input} />
      ),
    },
    {
      key: 'actions',
      header: <span className={sharedStyles.srOnly}>{text.details}</span>,
      render: (refund) => {
        const waiting = refund.status === 'REQUESTED'
        const detailsName = text.detailsFor(refund.orderId)
        const blocked = blockOf(refund)
        const noteId = `${blockId}-${refund.id}`
        return (
          <span className={sharedStyles.actions}>
            {waiting && onApprove && (
              <Button
                variant="secondary"
                size="sm"
                aria-label={panel.approveFor(money(refund), refund.orderId)}
                aria-disabled={blocked !== null ? true : undefined}
                aria-describedby={blocked !== null ? noteId : undefined}
                onClick={blocked !== null ? undefined : () => onApprove(refund)}
              >
                {panel.approve}
              </Button>
            )}
            {waiting && onApprove && blocked !== null && (
              <span id={noteId} className={sharedStyles.muted}>
                {blocked}
              </span>
            )}
            {waiting && onReject && (
              <Button
                variant="secondary"
                size="sm"
                aria-label={panel.rejectFor(money(refund), refund.orderId)}
                onClick={() => onReject(refund)}
              >
                {panel.reject}
              </Button>
            )}
            {renderAction
              ? renderAction(refund, text.details, detailsName, rowActionClass)
              : onOpenOrder && (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={detailsName}
                    onClick={() => onOpenOrder(refund)}
                  >
                    {text.details}
                  </Button>
                )}
          </span>
        )
      },
    },
  ]

  return (
    <ListFrame
      hasRows={refunds.length > 0}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onLoadMore={onLoadMore}
      loadingMore={loadingMore}
      empty={{ title: text.emptyTitle, description: text.emptyDescription }}
      labels={labels}
    >
      <Table
        caption={text.caption}
        columns={columns}
        rows={refunds}
        rowKey={(refund) => refund.id}
      />
    </ListFrame>
  )
}
