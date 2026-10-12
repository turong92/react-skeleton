import { paymentKeys, type PaymentConfig, type SubscriptionPlan } from '@skeleton/payment'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { SubscribePage } from './SubscribePage'

afterEach(async () => {
  await i18n.setLocale('ko', { remember: false })
})

const plan = (code: string, name: string, amount: number): SubscriptionPlan => ({
  code,
  name,
  amount: { amount, currency: 'KRW' },
  period: 'P1M',
  level: 1,
})
const plans = [
  plan('basic', 'Basic', 3900),
  plan('standard', 'Standard', 6900),
  plan('pro', 'Pro', 9900),
]
const config: PaymentConfig = { available: true, testMode: true, refundRequestsEnabled: true }

function render(data: { plans?: SubscriptionPlan[]; config?: PaymentConfig }) {
  const client = new QueryClient()
  if (data.plans) client.setQueryData(paymentKeys.subscriptionPlans(), data.plans)
  if (data.config) client.setQueryData(paymentKeys.config(), data.config)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SubscribePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SubscribePage', () => {
  it('shows a card per plan with the price per period and one filled 「구독하기」 each', () => {
    const html = render({ plans, config })
    for (const price of ['3,900원 · 1개월마다 결제', '6,900원 · 1개월마다 결제', '9,900원 · 1개월마다 결제'])
      expect(html).toContain(price)
    expect(html.match(/data-variant="primary"/g)).toHaveLength(3)
    expect(html).toContain('aria-label="구독하기: 베이직"')
  })

  it('names plans by their code in the language of the screen, and falls back to the server name for a code it has no translation for', async () => {
    const extra = [...plans, plan('team', 'Team', 19900)]
    expect(render({ plans: extra, config })).toMatch(/베이직[\s\S]*스탠다드[\s\S]*프로[\s\S]*Team/)
    await i18n.setLocale('en', { remember: false })
    const html = render({ plans: extra, config })
    expect(html).toContain('Basic')
    expect(html).toContain('Standard')
    expect(html).toContain('Team')
    expect(html).toContain('₩3,900, billed every month')
  })

  it('says it is a test payment when the server runs on test keys', () => {
    expect(render({ plans, config })).toContain('테스트 결제예요')
    expect(render({ plans, config: { ...config, testMode: false } })).not.toContain(
      '테스트 결제예요',
    )
  })

  it('still loading the plans: a spinner, no cards', () => {
    expect(render({})).not.toContain('구독하기')
  })
})
