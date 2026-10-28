import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { formatMoney } from './format'
import type { PaymentLabels } from './labels'
import type { Order, Settlement } from './ledgerTypes'

/**
 * 이 주문의 정산 방식. 서버의 `settlement` 가 이기고, 없는 구버전 응답은 예약 결제사 id 로 안다 -
 * `free`(쿠폰으로 0원) · `exempt`(결제 면제). 둘은 라우터가 고르는 결제사가 아니다
 */
export function settlementOf(order: Pick<Order, 'settlement'> & { provider?: string }): Settlement {
  if (order.settlement) return order.settlement
  if (order.provider === 'exempt') return 'EXEMPT'
  if (order.provider === 'free') return 'FREE'
  return 'PROVIDER'
}

/** 정산 알약의 글자 - 결제사가 받은 보통 결제에는 없다(`null`) */
export function settlementLabel(
  settlement: Settlement,
  labels: Pick<PaymentLabels, 'discount'>,
): string | null {
  return settlement === 'PROVIDER' ? null : labels.discount.settlement[settlement]
}

export type DiscountLineView = {
  kind: 'original' | 'discount' | 'final'
  label: string
  /** 서식을 입힌 금액 - 할인 줄은 앞에 `-` */
  value: string
}

/**
 * 금액 줄 - 상품 금액 · 할인마다 한 줄(이름은 서버가 준 `label`) · 결제 금액. 할인이 없으면 빈 배열(금액 한 줄만 그린다).
 * 결제 면제(`EXEMPT`)는 할인이 아니라 줄이 없다 - 「결제 면제」 알약이 말한다
 */
export function discountLines(
  order: Pick<
    Order,
    'amount' | 'originalAmount' | 'discountAmount' | 'discounts' | 'settlement'
  > & {
    provider?: string
  },
  labels: Pick<PaymentLabels, 'discount' | 'currencySuffix'>,
  { locale }: { locale?: string } = {},
): DiscountLineView[] {
  if (settlementOf(order) === 'EXEMPT') return []
  const discounts = order.discounts ?? []
  if (!(order.discountAmount ?? 0) || discounts.length === 0 || order.originalAmount == null)
    return []
  const money = (amount: number) =>
    formatMoney(
      { amount, currency: order.amount.currency },
      { locale, currencySuffix: labels.currencySuffix },
    )
  return [
    { kind: 'original', label: labels.discount.original, value: money(order.originalAmount) },
    ...discounts.map((d) => ({
      kind: 'discount' as const,
      label: d.label,
      value: `-${money(d.amount)}`,
    })),
    { kind: 'final', label: labels.discount.final, value: money(order.amount.amount) },
  ]
}

const DISCOUNT_ERRORS = {
  [ErrorCodes.PAYMENT_DISCOUNT_NOT_APPLICABLE]: 'notApplicable',
  [ErrorCodes.PAYMENT_DISCOUNT_UNAVAILABLE]: 'unavailable',
  [ErrorCodes.PAYMENT_DISCOUNT_NOT_SUPPORTED]: 'notSupported',
  [ErrorCodes.PAYMENT_DISCOUNT_BELOW_MINIMUM]: 'belowMinimum',
  [ErrorCodes.PAYMENT_NOTHING_TO_REFUND]: 'nothingToRefund',
} as const

/** 할인 · 0원 환불 오류(`PAYMENT.DISCOUNT_*` · `PAYMENT.NOTHING_TO_REFUND`)의 문장. 그 밖의 오류는 `null` - 부른 쪽이 제 문구를 쓴다 */
export function discountErrorMessage(
  error: unknown,
  labels: Pick<PaymentLabels, 'discount'>,
): string | null {
  if (!(error instanceof ApiRequestError)) return null
  const key = (DISCOUNT_ERRORS as Record<string, keyof PaymentLabels['discount']['errors']>)[
    error.apiError.code
  ]
  return key ? labels.discount.errors[key] : null
}
