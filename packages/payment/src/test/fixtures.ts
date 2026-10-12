import type { AdminOrder, AdminRefund, PaymentEvent, WebhookEvent } from '../admin/types'
import type { Order, Refund } from '../ledgerTypes'
import type { Subscription } from '../subscriptionTypes'

/** 테스트 · 스토리가 함께 쓰는 만들기 도우미(공개 표면 아님 — index.ts 가 내보내지 않는다) */
export const at = '2026-01-01T03:00:00Z'

export const order = (over: Partial<Order> = {}): Order => ({
  id: 'ord_1',
  status: 'PAID',
  kind: 'ONE_TIME',
  itemType: 'cheer',
  itemRef: 'cheer-3000',
  quantity: 1,
  orderName: 'Cheer 3,000',
  amount: { amount: 3000, currency: 'KRW' },
  refundedAmount: 0,
  refundableAmount: 3000,
  refundPending: false,
  openRefundStatus: null,
  method: 'CARD',
  card: { issuer: 'HYUNDAI', last4: '1234' },
  testMode: false,
  failureCode: null,
  createdAt: at,
  paidAt: at,
  fulfilled: true,
  ...over,
})

export const refund = (over: Partial<Refund> = {}): Refund => ({
  id: 'rfd_1',
  orderId: 'ord_1',
  status: 'REQUESTED',
  amount: { amount: 3000, currency: 'KRW' },
  reasonCode: 'CUSTOMER_REQUEST',
  origin: 'USER',
  requestedAt: at,
  completedAt: null,
  closedBy: null,
  ...over,
})

/** 운영자 응답 도우미 — 사용자 응답에 운영자 칸을 더한다 */
export const adminOrder = (over: Partial<AdminOrder> = {}): AdminOrder => ({
  ...order(),
  accountId: 'acc_1',
  provider: 'toss',
  providerPaymentId: 'tgen_9f8e7d',
  reviewReason: null,
  ...over,
})

export const adminRefund = (over: Partial<AdminRefund> = {}): AdminRefund => ({
  ...refund(),
  requestedBy: 'acc_1',
  decidedBy: null,
  failureCode: null,
  ...over,
})

export const paymentEvent = (over: Partial<PaymentEvent> = {}): PaymentEvent => ({
  id: 1,
  refundId: null,
  type: 'CONFIRM_SUCCEEDED',
  fromStatus: 'CONFIRMING',
  toStatus: 'PAID',
  actor: 'PROVIDER',
  actorId: null,
  providerCode: null,
  providerTraceId: null,
  traceId: null,
  createdAt: at,
  ...over,
})

export const webhookEvent = (over: Partial<WebhookEvent> = {}): WebhookEvent => ({
  id: 7,
  provider: 'toss',
  eventType: 'PAYMENT_STATUS_CHANGED',
  resourceType: 'PAYMENT',
  resourceId: 'tgen_9f8e7d',
  orderId: 'ord_1',
  status: 'PROCESSED',
  deliveries: 1,
  lastError: null,
  receivedAt: at,
  processedAt: at,
  ...over,
})

export const subscription = (over: Partial<Subscription> = {}): Subscription => ({
  id: 'sub_1',
  status: 'ACTIVE',
  planCode: 'standard',
  planName: 'Standard',
  amount: { amount: 6900, currency: 'KRW' },
  period: 'P1M',
  currentPeriodStart: '2026-10-01T03:00:00Z',
  currentPeriodEnd: '2026-11-01T03:00:00Z',
  attempt: 1,
  endReason: null,
  card: { issuer: 'HYUNDAI', last4: '1234' },
  pendingPlanCode: null,
  testMode: false,
  createdAt: '2026-10-01T03:00:00Z',
  country: null,
  ...over,
})
