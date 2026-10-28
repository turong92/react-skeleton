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
// 운영 카탈로그(상품 · 가격) - 백엔드 `catalog` 모듈의 `skeleton.catalog.admin.enabled=true` + 권한 `catalog.manage`(없으면 403, 꺼져 있으면 404 - `adminAccessProblem`)
export { createCatalogAdminApi } from './catalogAdminApi'
export type { CatalogAdminApi, CatalogAdminApiOptions } from './catalogAdminApi'
export type {
  AddCatalogPriceInput,
  AdminCatalogPrice,
  AdminCatalogProduct,
  CreateCatalogProductInput,
  UpdateCatalogProductInput,
} from './catalogAdminTypes'
export {
  catalogAdminKeys,
  useAdminCatalogProducts,
  useCatalogAdminMutations,
  useCatalogProviders,
} from './catalogAdminQueries'
export { catalogProblemOf } from './catalogErrors'
export type { CatalogProblem } from './catalogErrors'
export { priceStateOf } from './priceState'
export type { PriceState } from './priceState'
export { productTextOf } from './catalogText'
export { AdminCatalogTable } from './AdminCatalogTable'
export type { AdminCatalogTableProps } from './AdminCatalogTable'
export { AdminProductEditor } from './AdminProductEditor'
export type { AdminProductEditorProps } from './AdminProductEditor'
export type { ProductLanguage } from './productForm'
export { AdminPriceList } from './AdminPriceList'
export type { AdminPriceListProps } from './AdminPriceList'
export { AddPriceDialog } from './AddPriceDialog'
export type { AddPriceDialogProps } from './AddPriceDialog'
export { SaleEndDialog } from './SaleEndDialog'
export type { SaleEndDialogProps } from './SaleEndDialog'
export { StopPriceDialog } from './StopPriceDialog'
export type { StopPriceDialogProps } from './StopPriceDialog'
export { PAYMENT_PERMISSIONS, CATALOG_PERMISSIONS } from './permissions'
export type { CanFn } from './permissions'
