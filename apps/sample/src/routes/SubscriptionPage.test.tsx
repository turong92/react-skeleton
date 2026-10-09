import { paymentKeys, type MySubscription, type Order, type Subscription } from '@skeleton/payment'
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
  testMode: false,
  createdAt: '2026-10-01T03:00:00Z',
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

function render(data: MySubscription | undefined) {
  const client = new QueryClient()
  if (data) client.setQueryData(paymentKeys.mySubscription(), data)
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
    expect(html).toContain('해지 예약')
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
    expect(html).not.toContain('해지 예약</button>')
  })

  it('still loading: no card yet', () => {
    expect(render(undefined)).not.toContain('해지 예약')
  })
})
