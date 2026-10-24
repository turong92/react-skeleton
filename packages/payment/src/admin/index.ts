// `@skeleton/payment/admin` — 운영자 부품(선택 내보내기). 쓰지 않는 프로젝트는 이 진입점을 import 하지 않으면 번들에도 들어오지 않는다.
// 백엔드는 `skeleton.payment.admin.enabled=true`(기본 꺼짐)와 권한(`payment.read` · `payment.refund` · `payment.operate`)이 필요하다 — 검사는 서버, 화면은 `RequirePermission` 과 부품의 `can`.
export { createPaymentAdminApi, OPERATOR_REFUND_TIMEOUT_MS } from './adminApi'
export type { PaymentAdminApi, PaymentAdminApiOptions } from './adminApi'
export { adminAccessProblem } from './adminAccess'
export type { AdminAccessProblem } from './adminAccess'
export type {
  AdminOrder,
  AdminOrderDetail,
  AdminOrderListParams,
  AdminRefund,
  AdminRefundListParams,
  OperatorRefundInput,
  OperatorRefundReason,
  PaymentEvent,
  ReviewReason,
  WebhookEvent,
  WebhookEventListParams,
  WebhookEventStatus,
} from './types'

export { adminKeys } from './adminQueries'
export {
  useAdminOrder,
  useAdminOrders,
  useAdminRefundRequests,
  useAdminWebhookEvents,
  useApproveRefund,
  useOperatorRefund,
  useRejectRefund,
  useRetryWebhookEvent,
  useCloseSubscriptionCharge,
  useSyncOrder,
} from './adminHooks'

// 화면 부품 — 문구는 `labels` prop(`@skeleton/payment` 의 `koPaymentLabels` 의 `admin` 가지 포함 — 한 벌이다)
export { AdminOrderTable } from './AdminOrderTable'
export type { AdminOrderFilter, AdminOrderTableProps } from './AdminOrderTable'
export { AdminOrderPanel } from './AdminOrderPanel'
export type { AdminOrderPanelProps } from './AdminOrderPanel'
export { CloseSubscriptionChargeDialog } from './CloseSubscriptionChargeDialog'
export type { CloseSubscriptionChargeDialogProps } from './CloseSubscriptionChargeDialog'
export { AdminRefundDialog } from './AdminRefundDialog'
export type { AdminRefundDialogProps } from './AdminRefundDialog'
export { heldSecondsOf, useDirectRefund } from './useDirectRefund'
export type { UseDirectRefundOptions } from './useDirectRefund'
export type { UnsureVerdict } from './unsureHold'
export { useRefundDecision } from './useRefundDecision'
export type { UseRefundDecisionOptions } from './useRefundDecision'
export { RefundNotDoneError, refundProblemOf } from './refundOutcome'
export type { RefundProblem } from './refundOutcome'
export { RefundRequestTable } from './RefundRequestTable'
export type { RefundRequestTableProps } from './RefundRequestTable'
export { WebhookEventTable } from './WebhookEventTable'
export type { WebhookEventTableProps } from './WebhookEventTable'
export type { RenderRowAction } from './rowAction'
export { PAYMENT_PERMISSIONS } from './permissions'
export type { CanFn } from './permissions'
