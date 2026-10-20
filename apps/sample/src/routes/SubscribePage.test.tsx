import {
  paddlePricesKey,
  paymentKeys,
  type PaymentConfig,
  type SubscriptionPlan,
} from '@skeleton/payment'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { SubscribePage } from './SubscribePage'

afterEach(async () => {
  await i18n.setLocale('ko', { remember: false })
})

const plan = (code: string, name: string, amount: number, period = 'P1M'): SubscriptionPlan => ({
  code,
  name,
  amount: { amount, currency: 'KRW' },
  period,
  level: 1,
})
const plans = [
  plan('basic', 'Basic', 3900),
  plan('standard', 'Standard', 6900),
  plan('pro', 'Pro', 9900),
]
const preview = {
  clientToken: 'test_token',
  environment: 'sandbox',
  prices: { basic: 'pri_basic', standard: 'pri_standard' },
}
const paddleConfig: PaymentConfig = {
  available: true,
  testMode: true,
  refundRequestsEnabled: true,
  providers: ['paddle'],
  provider: 'paddle',
  country: 'US',
  cancelPolicy: { key: 'period-end-only' },
  pricePreviews: { paddle: preview },
}
const config: PaymentConfig = { available: true, testMode: true, refundRequestsEnabled: true }

function render(data: {
  plans?: SubscriptionPlan[]
  config?: PaymentConfig
  paddlePrices?: Record<string, { total: string; period: string | null }>
}) {
  const client = new QueryClient()
  if (data.plans) client.setQueryData(paymentKeys.subscriptionPlans(), data.plans)
  if (data.config) client.setQueryData(paymentKeys.config(), data.config)
  if (data.paddlePrices) client.setQueryData(paddlePricesKey(preview), data.paddlePrices)
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
    for (const price of [
      '3,900원 · 1개월마다 결제',
      '6,900원 · 1개월마다 결제',
      '9,900원 · 1개월마다 결제',
    ])
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

  it('asks for a payment method only when the server offers two or more for a subscription - and names them in words', () => {
    const none = render({ plans, config })
    expect(none).not.toContain('결제 방법')
    const one = render({ plans, config: { ...config, subscriptionChoices: ['toss'] } })
    expect(one).not.toContain('결제 방법')
    const html = render({
      plans,
      config: {
        ...config,
        provider: 'toss',
        subscriptionChoices: ['toss', 'kakaopay', 'naverpay'],
      },
    })
    expect(html).toContain('결제 방법')
    for (const name of ['토스페이먼츠', '카카오페이', '네이버페이']) expect(html).toContain(name)
    // 서버가 정한 결제사(토스)가 처음 골라져 있다
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
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

  it('pays with Paddle: shows the amount Paddle quotes, never the KRW table amount, and hides the amount of a plan Paddle did not quote', () => {
    const html = render({
      plans,
      config: paddleConfig,
      paddlePrices: {
        basic: { total: '$3.99', period: 'P1M' },
        standard: { total: '$6.99', period: 'P1M' },
      },
    })
    expect(html).toContain('$3.99 · 1개월마다 결제')
    expect(html).toContain('$6.99 · 1개월마다 결제')
    expect(html).toContain('결제창에서 금액을 확인하세요') // pro 는 가격 id 가 없다
    expect(html).not.toContain('원 · 1개월마다 결제')
  })

  it('while Paddle is quoting there is a placeholder and no KRW amount', () => {
    const html = render({ plans, config: paddleConfig })
    expect(html).toContain('금액 확인 중')
    expect(html).not.toContain('3,900원')
  })

  it('words the cycle from the Paddle price, not from our local plan period (PT3M here), and shows only the amount for a price without a cycle', () => {
    const html = render({
      plans: [plan('basic', 'Basic', 3900, 'PT3M'), plan('standard', 'Standard', 6900, 'PT3M')],
      config: paddleConfig,
      paddlePrices: {
        basic: { total: '$3.99', period: 'P1M' },
        standard: { total: '$6.99', period: null },
      },
    })
    expect(html).toContain('$3.99 · 1개월마다 결제')
    expect(html).toContain('$6.99')
    expect(html).not.toContain('$6.99 ·')
    expect(html).not.toContain('3분')
  })

  it('shows the country the server decided and the rules of that country - read only, no country choice - and the refund policy link', () => {
    const korea = render({
      plans,
      config: {
        ...config,
        providers: ['toss'],
        provider: 'toss',
        country: 'KR',
        cancelPolicy: { key: 'korea', penaltyPercent: 10, withdrawalDays: 7 },
      },
    })
    expect(korea).toContain('결제 국가: 대한민국')
    expect(korea).toContain('7일 안에 쓰지 않았다면 전액 환불')
    expect(korea).toContain('위약금 10%')
    expect(korea).toContain('href="/refund"')
    expect(korea).not.toContain('<select')
    const abroad = render({ plans, config: paddleConfig, paddlePrices: {} })
    expect(abroad).toContain('결제 국가: 미국')
    expect(abroad).toContain('결제는 Paddle 이 처리해요')
    expect(abroad).toContain('환불은 Paddle 이 검토해요')
  })
})
