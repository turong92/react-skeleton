import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from './labels'
import { MySubscriptionCard } from './MySubscriptionCard'
import { OrderList } from './OrderList'
import { OrderSummary } from './OrderSummary'
import { PaymentResult } from './PaymentResult'
import { order, subscription } from './test/fixtures'
import type { Order } from './ledgerTypes'

const common = { labels: koPaymentLabels, locale: 'ko-KR', formatTime: () => '2026. 1. 1.' }
const noop = () => undefined

const discounted: Order = order({
  amount: { amount: 8400, currency: 'KRW' },
  originalAmount: 12000,
  discountAmount: 3600,
  discounts: [{ type: 'coupon', ref: 'c1', label: '가입 환영 쿠폰', amount: 3600 }],
  settlement: 'PROVIDER',
})
const free: Order = order({
  amount: { amount: 0, currency: 'KRW' },
  originalAmount: 3000,
  discountAmount: 3000,
  discounts: [{ type: 'coupon', ref: 'c2', label: '무료 이용권', amount: 3000 }],
  settlement: 'FREE',
  refundableAmount: 0,
  method: null,
  card: null,
})
const exempt: Order = order({
  amount: { amount: 0, currency: 'KRW' },
  originalAmount: 3000,
  discountAmount: 0,
  discounts: [],
  settlement: 'EXEMPT',
  refundableAmount: 0,
  method: null,
  card: null,
})

describe('OrderSummary with a discount', () => {
  it('shows original, the coupon line and the final price', () => {
    const html = renderToStaticMarkup(<OrderSummary {...common} order={discounted} refunds={[]} />)
    for (const text of [
      '상품 금액',
      '12,000원',
      '가입 환영 쿠폰',
      '-3,600원',
      '결제 금액',
      '8,400원',
    ])
      expect(html, text).toContain(text)
  })
  it('a free order says 무료(쿠폰) and offers no refund; an exempt one says 결제 면제 with no discount lines', () => {
    const f = renderToStaticMarkup(
      <OrderSummary
        {...common}
        order={free}
        refunds={[]}
        onRequestRefund={noop}
        refundRequestsEnabled
      />,
    )
    expect(f).toContain('무료(쿠폰)')
    expect(f).not.toContain('환불 요청')
    const e = renderToStaticMarkup(
      <OrderSummary
        {...common}
        order={exempt}
        refunds={[]}
        onRequestRefund={noop}
        refundRequestsEnabled
      />,
    )
    expect(e).toContain('결제 면제')
    expect(e).not.toContain('상품 금액')
    expect(e).not.toContain('환불 요청')
  })
  it('an ordinary order is unchanged: one amount, no settlement label', () => {
    const html = renderToStaticMarkup(<OrderSummary {...common} order={order()} refunds={[]} />)
    expect(html).not.toMatch(/상품 금액|결제 면제|무료\(쿠폰\)/)
  })
})

describe('OrderList and PaymentResult', () => {
  it('list rows carry the settlement label', () => {
    const html = renderToStaticMarkup(
      <OrderList {...common} orders={[exempt, free, order({ id: 'o3' })]} />,
    )
    expect(html.match(/결제 면제/g)).toHaveLength(1)
    expect(html.match(/무료\(쿠폰\)/g)).toHaveLength(1)
  })
  it('a free or exempt result is paid without a payment method, and says why', () => {
    const f = renderToStaticMarkup(<PaymentResult {...common} order={free} />)
    expect(f).toContain('쿠폰으로 0원이라')
    const e = renderToStaticMarkup(<PaymentResult {...common} order={exempt} />)
    expect(e).toContain('결제 면제')
    const normal = renderToStaticMarkup(<PaymentResult {...common} order={discounted} />)
    expect(normal).toContain('가입 환영 쿠폰')
    expect(normal).not.toContain('쿠폰으로 0원이라')
  })
})

describe('MySubscriptionCard with a discount', () => {
  it('says the next payment and how many discounted payments are left', () => {
    const sub = subscription({
      discount: {
        label: '첫 달 무료 후 반값',
        stages: [{ type: 'PERCENT', value: 50, maxDiscount: null, periods: 3 }],
        periodsUsed: 1,
        nextAmount: 3450,
        remainingPeriods: 2,
      },
    })
    const html = renderToStaticMarkup(
      <MySubscriptionCard {...common} subscription={sub} orders={[]} />,
    )
    expect(html).toContain('다음 결제 3,450원(할인 2회 남음)')
    expect(html).toContain('첫 달 무료 후 반값')
  })
  it('a forever discount has no count; no discount shows nothing', () => {
    const forever = subscription({
      discount: {
        label: '평생 10%',
        stages: [],
        periodsUsed: 4,
        nextAmount: 6210,
        remainingPeriods: null,
      },
    })
    const html = renderToStaticMarkup(
      <MySubscriptionCard {...common} subscription={forever} orders={[]} />,
    )
    expect(html).toContain('다음 결제 6,210원(할인 계속 적용)')
    const none = renderToStaticMarkup(
      <MySubscriptionCard {...common} subscription={subscription()} orders={[]} />,
    )
    expect(none).not.toMatch(/다음 결제 [0-9]/)
  })
})
