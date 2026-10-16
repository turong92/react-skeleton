import { paddlePricesKey, paymentKeys, type PaymentConfig } from '@skeleton/payment'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { cheerKeys } from '../cheer/queries'
import type { CheerOption } from '../cheer/types'
import { i18n } from '../i18n'
import { CheerPage } from './CheerPage'

afterEach(async () => {
  await i18n.setLocale('ko', { remember: false })
})

const options: CheerOption[] = [1000, 3000, 5000].map((amount) => ({
  itemRef: `cheer-${amount}`,
  amount: { amount, currency: 'KRW' },
}))
const config = (over: Partial<PaymentConfig> = {}): PaymentConfig => ({
  available: true,
  testMode: true,
  refundRequestsEnabled: true,
  ...over,
})

const paddlePreview = {
  clientToken: 'test_token',
  environment: 'sandbox',
  prices: { 'cheer-1000': 'pri_1', 'cheer-3000': 'pri_3', 'cheer-5000': 'pri_5' },
}

function render(data: {
  options?: CheerOption[]
  config?: PaymentConfig
  paddlePrices?: Record<string, { total: string; period: string | null }>
}) {
  const client = new QueryClient()
  if (data.options) client.setQueryData(cheerKeys.options(), data.options)
  if (data.config) client.setQueryData(paymentKeys.config(), data.config)
  if (data.paddlePrices) client.setQueryData(paddlePricesKey(paddlePreview), data.paddlePrices)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CheerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CheerPage', () => {
  it('shows the amounts the server offers as pressable choices, with the middle one already chosen', () => {
    const html = render({ options, config: config() })
    expect(html).toContain('응원하기')
    for (const label of ['1,000원', '3,000원', '5,000원']) expect(html).toContain(label)
    expect(html.match(/role="radio"/g)).toHaveLength(3)
    expect(html).toMatch(/<button[^>]*aria-checked="true"[^>]*>.*?3,000원/)
  })

  it('has exactly one filled button — the one that pays (the choices are outlined)', () => {
    const html = render({ options, config: config() })
    expect(html.match(/data-variant="primary"/g)).toHaveLength(1)
    expect(html).toMatch(/<button[^>]*data-variant="primary"[^>]*>[^<]*응원하기/)
  })

  it('says it is a test payment next to the button when the server runs on test keys', () => {
    expect(render({ options, config: config({ testMode: true }) })).toContain('테스트 결제예요')
    expect(render({ options, config: config({ testMode: false }) })).not.toContain(
      '테스트 결제예요',
    )
  })

  it('draws a 「결제 방법」 choice only when the server has opened more than one provider for this country (Toss + KakaoPay), with the server pick chosen', () => {
    const two = render({
      options,
      config: config({ provider: 'toss', choices: ['toss', 'kakaopay'] }),
    })
    expect(two).toContain('결제 방법')
    expect(two).toContain('토스페이먼츠')
    expect(two).toContain('카카오페이')
    expect(two).toMatch(/<button[^>]*aria-checked="true"[^>]*>.*?토스페이먼츠/)
    expect(two.match(/role="radio"/g)).toHaveLength(5) // 금액 셋 + 결제 방법 둘

    for (const choices of [undefined, [], ['toss']]) {
      const one = render({
        options,
        config: config({ provider: 'toss', ...(choices ? { choices } : {}) }),
      })
      expect(one).not.toContain('결제 방법')
      expect(one.match(/role="radio"/g)).toHaveLength(3)
    }
  })

  it('names NaverPay in the choice when it is one of three providers open for the country', () => {
    const html = render({
      options,
      config: config({ provider: 'toss', choices: ['toss', 'kakaopay', 'naverpay'] }),
    })
    expect(html).toContain('네이버페이')
    expect(html.match(/role="radio"/g)).toHaveLength(6) // 금액 셋 + 결제 방법 셋
  })

  it('with no server pick (two providers and no country map) the first choice is chosen so the person always sends one', () => {
    const html = render({
      options,
      config: config({ provider: null, choices: ['kakaopay', 'toss'] }),
    })
    expect(html).toMatch(/<button[^>]*aria-checked="true"[^>]*>.*?카카오페이/)
  })

  it('draws one outlined button per easy pay the server offers for its provider, next to the card button', () => {
    const html = render({
      options,
      config: config({ provider: 'toss', easyPays: { toss: ['NAVERPAY', 'KAKAOPAY', 'TOSSPAY'] } }),
    })
    for (const name of ['네이버페이', '카카오페이', '토스페이'])
      expect(html).toMatch(new RegExp(`<button[^>]*data-variant="secondary"[^>]*>[^<]*${name}`))
    expect(html.match(/data-variant="primary"/g)).toHaveLength(1)
  })

  it('draws no easy pay button when the list is empty or belongs to another provider - the screen is what it was', () => {
    for (const over of [
      {},
      { provider: 'toss', easyPays: {} },
      { provider: 'paddle', easyPays: { toss: ['NAVERPAY'] } },
    ] as Partial<PaymentConfig>[]) {
      const html = render({ options, config: config(over) })
      expect(html).not.toContain('네이버페이')
      expect(html).not.toContain('간편결제')
    }
  })

  it('while the screen is held the easy pay buttons are aria-disabled and give the same reason as the card button', () => {
    const html = render({
      options,
      config: config({ available: false, provider: 'toss', easyPays: { toss: ['NAVERPAY'] } }),
    })
    const button =
      html.match(/<button[^>]*data-variant="secondary"[^>]*>[^<]*네이버페이/)?.[0] ?? ''
    expect(button).toContain('aria-disabled="true"')
    expect(button).not.toMatch(/\sdisabled/)
    expect(button).toMatch(/aria-describedby="[^"]+"/)
  })

  it('a button that cannot be pressed stays reachable and says why next to it (not a bare disabled button)', () => {
    const html = render({ options, config: config({ available: false }) })
    const button = html.match(/<button[^>]*data-variant="primary"[^>]*>/)?.[0] ?? ''
    expect(button).toContain('aria-disabled="true"')
    expect(button).not.toMatch(/\sdisabled/)
    const describedBy = button.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(describedBy).toBeTruthy()
    expect(html).toMatch(new RegExp(`id="${describedBy}"[^>]*>지금은 결제를 쓸 수 없어요`))
  })

  it('a re-read of the amounts that fails while they are on screen keeps the form (nothing to reload, the choices are still good)', () => {
    const client = new QueryClient()
    client
      .getQueryCache()
      .build(client, { queryKey: cheerKeys.options() })
      .setState({
        status: 'error',
        error: new Error('network'),
        fetchStatus: 'idle',
        data: options,
      })
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CheerPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(html).toContain('role="radio"')
  })

  it('while the amounts are loading there is a spinner and no way to pay', () => {
    const html = render({})
    expect(html).toContain('불러오는 중')
    expect(html).not.toContain('role="radio"')
  })

  it('an empty list of amounts says so instead of showing a button that pays nothing', () => {
    const html = render({ options: [], config: config() })
    expect(html).toContain('고를 수 있는 금액이 없어요')
    expect(html).not.toContain('role="radio"')
  })

  it('English: the English words and a currency the English reader knows', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render({ options, config: config() })
    expect(html).toContain('Send a cheer')
    expect(html).toContain('₩3,000')
    expect(html).not.toMatch(/[가-힣]/)
  })

  it('the rate-limit sentences name the time it opens again, never a count of minutes that would not shrink, in both languages', async () => {
    expect(i18n.t('cheer.rateLimited', { time: '오후 3:42' })).toBe(
      '요청이 많아요. 오후 3:42 이후에 다시 눌러 주세요.',
    )
    expect(i18n.t('cheer.rateLimitedWait', { time: '오후 3:42' })).toBe(
      '오후 3:42 이후에 다시 누를 수 있어요',
    )
    await i18n.setLocale('en', { remember: false })
    expect(i18n.t('cheer.rateLimited', { time: '3:42 PM' })).toBe(
      'There are too many requests. Please try again after 3:42 PM.',
    )
    expect(i18n.t('cheer.rateLimitedWait', { time: '3:42 PM' })).toBe(
      'You can press again after 3:42 PM',
    )
    expect(i18n.t('cheer.rateLimitedSoon')).toContain('in a moment')
  })

  it('pays with Paddle: the choices show the amounts Paddle quotes instead of the KRW table', () => {
    const paddle = config({
      providers: ['paddle'],
      provider: 'paddle',
      pricePreviews: { paddle: paddlePreview },
    })
    const html = render({
      options,
      config: paddle,
      paddlePrices: {
        'cheer-1000': { total: '$0.99', period: null },
        'cheer-3000': { total: '$2.99', period: null },
        'cheer-5000': { total: '$4.99', period: null },
      },
    })
    for (const label of ['$0.99', '$2.99', '$4.99']) expect(html).toContain(label)
    expect(html).not.toContain('3,000원')
    // 아직 못 받았거나 못 받으면 원화 표로 되돌아가지 않는다
    const pending = render({ options, config: paddle })
    expect(pending).toContain('금액 확인 중')
    expect(pending).not.toContain('3,000원')
  })
})
