import { paymentKeys, type MySubscription, type Subscription } from '@skeleton/payment'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { SubscriptionReturnPage } from './SubscriptionReturnPage'

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

function render(search: string, me?: MySubscription) {
  const client = new QueryClient()
  if (me) client.setQueryData(paymentKeys.mySubscription(), me)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/subscriptions/return${search}`]}>
        <SubscriptionReturnPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SubscriptionReturnPage', () => {
  const back = '?sub=sub_1&customerKey=cus_1&authKey=bk_1'

  it('the first payment went through: the payment result with the plan name, price and the way to 「내 구독」', () => {
    const html = render(back, { subscription: sub(), orders: [] })
    expect(html).toContain('결제됐어요')
    expect(html).toContain('스탠다드')
    expect(html).toContain('6,900원')
    expect(html).toContain('내 구독')
  })

  it('the provider has not answered about the first payment: still checking', () => {
    const html = render(back, { subscription: sub({ status: 'PENDING' }), orders: [] })
    expect(html).toContain('결제 확인 중')
  })

  it('before anything is read: checking, not a result', () => {
    expect(render(back)).toContain('결제 확인 중')
  })

  it('an address that says it failed, with the window closed by the person: says the card was not registered by their choice', () => {
    const html = render('?sub=sub_1&code=PAY_PROCESS_CANCELED&message=x')
    expect(html).toContain('카드 등록을 그만뒀어요')
    expect(html).toMatch(/다시 해 보기/)
  })

  it('an address that says it failed for another reason: says the card was not registered', () => {
    expect(render('?sub=sub_1&code=INVALID_CARD&message=x')).toContain('카드를 등록하지 못했어요')
  })

  it('an address that cannot be read: says so and leads to 「내 구독」 (a link, not a dead end)', () => {
    const html = render('')
    expect(html).toContain('구독 결과를 읽지 못했어요')
    expect(html).toContain('href="/subscription"')
  })
})
