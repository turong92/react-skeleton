import {
  paymentKeys,
  type CancelPreview,
  type MySubscription,
  type Order,
  type Subscription,
} from '@skeleton/payment'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { SubscriptionPage } from './SubscriptionPage'

afterEach(async () => {
  await i18n.setLocale('ko', { remember: false })
})

const sub = (over: Partial<Subscription> = {}): Subscription => ({
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
  country: 'KR',
  ...over,
})
const paid = {
  id: 'ord_7',
  orderName: 'Standard',
  status: 'PAID',
  kind: 'SUBSCRIPTION_INITIAL',
  amount: { amount: 6900, currency: 'KRW' },
  method: 'CARD',
  card: { issuer: 'HYUNDAI', last4: '1234' },
  openRefundStatus: null,
  createdAt: '2026-10-01T03:00:00Z',
  paidAt: '2026-10-01T03:00:05Z',
} as Order

const catalog = [
  {
    code: 'basic',
    name: 'Basic',
    amount: { amount: 3900, currency: 'KRW' },
    period: 'P1M',
    level: 1,
  },
  {
    code: 'standard',
    name: 'Standard',
    amount: { amount: 6900, currency: 'KRW' },
    period: 'P1M',
    level: 2,
  },
  { code: 'pro', name: 'Pro', amount: { amount: 9900, currency: 'KRW' }, period: 'P1M', level: 3 },
]

function render(data: MySubscription | undefined, plans = false, cancel?: CancelPreview) {
  const client = new QueryClient()
  if (data) client.setQueryData(paymentKeys.mySubscription(), data)
  if (cancel) client.setQueryData(paymentKeys.cancelPreview('sub_1'), cancel)
  if (plans) client.setQueryData(paymentKeys.subscriptionPlans(), catalog)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SubscriptionPage', () => {
  it('no subscription yet: says so and leads to the plans with a filled link', () => {
    const html = render({ subscription: null, orders: [] })
    expect(html).toContain('구독 중이 아니에요')
    expect(html).toMatch(/<a[^>]*href="\/subscribe"[^>]*>플랜 보기/)
  })

  it('an active subscription: the translated plan name, the card, and a link from each recent payment to /payments/:id', () => {
    const html = render({ subscription: sub(), orders: [paid] })
    expect(html).toContain('스탠다드')
    expect(html).toContain('구독 중')
    expect(html).toContain('기간 끝에 해지')
    expect(html).toContain('href="/payments/ord_7"')
    expect(html).not.toContain('다시 구독하기')
  })

  it('an ended subscription says why and offers to subscribe again (one filled link, no cancel)', () => {
    const html = render({
      subscription: sub({ status: 'ENDED', endReason: 'PAYMENT_FAILED', card: null }),
      orders: [],
    })
    expect(html).toContain('카드를 확인하고 다시 구독해 주세요')
    expect(html).toMatch(/<a[^>]*href="\/subscribe"[^>]*>다시 구독하기/)
    expect(html).not.toContain('기간 끝에 해지</button>')
  })

  it('with higher plans on offer an active subscription can be raised; the top plan has nothing above it', () => {
    expect(render({ subscription: sub(), orders: [] }, true)).toMatch(
      /data-variant="primary"[^>]*>플랜 올리기</,
    )
    const top = render({ subscription: sub({ planCode: 'pro' }), orders: [] }, true)
    expect(top).not.toContain('플랜 올리기')
    expect(top).toContain('기간 끝에 해지')
  })

  it('「지금 해지하고 환불」 shows only when the country policy opened it, next to the period-end cancel with the same weight; a policy that closed it leaves just the period-end cancel', () => {
    const open: CancelPreview = {
      open: true,
      refund: { amount: 6900, currency: 'KRW' },
      withdrawal: true,
      lines: [{ code: 'PAID', amount: 6900 }],
    }
    const opened = render({ subscription: sub(), orders: [] }, false, open)
    expect(opened).toMatch(/data-variant="secondary"[^>]*>지금 해지하고 환불</)
    expect(opened).toMatch(/data-variant="secondary"[^>]*>기간 끝에 해지</)
    const closed = render({ subscription: sub(), orders: [] }, false, { ...open, open: false })
    expect(closed).not.toMatch(/<button[^>]*>지금 해지하고 환불</)
    expect(closed).toContain('기간 끝에 해지')
    expect(render({ subscription: sub(), orders: [] })).not.toMatch(/<button[^>]*>지금 해지하고 환불</)
  })

  it('an already scheduled end can still be ended now', () => {
    const html = render({ subscription: sub({ status: 'CANCELING' }), orders: [] }, false, {
      open: true,
      refund: { amount: 100, currency: 'KRW' },
      withdrawal: false,
      lines: [],
    })
    expect(html).toMatch(/<button[^>]*>지금 해지하고 환불</)
  })

  it('links to the refund policy', () => {
    expect(render({ subscription: sub(), orders: [] })).toMatch(/<a[^>]*href="\/refund"/)
  })

  it('still loading: no card yet', () => {
    expect(render(undefined)).not.toContain('기간 끝에 해지')
  })
})
