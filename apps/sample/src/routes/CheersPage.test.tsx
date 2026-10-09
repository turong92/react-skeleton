import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { cheerKeys } from '../cheer/queries'
import type { Cheer } from '../cheer/types'
import { i18n } from '../i18n'
import { CheersPage, CHEERS_PAGE_SIZE } from './CheersPage'

afterEach(async () => {
  await i18n.setLocale('ko', { remember: false })
})

const cheer = (over: Partial<Cheer> = {}): Cheer => ({
  orderId: 'ord_1',
  amount: { amount: 3000, currency: 'KRW' },
  refundedAmount: 0,
  status: 'PAID',
  createdAt: '2026-10-09T01:00:00Z',
  refundedAt: null,
  ...over,
})

function render(values?: Cheer[]) {
  const client = new QueryClient()
  if (values)
    client.setQueryData(cheerKeys.mine({ size: CHEERS_PAGE_SIZE }), {
      pages: [{ values, cursor: { hasNext: false, nextCursor: null }, meta: {} }],
      pageParams: [undefined],
    })
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CheersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CheersPage — 내 응원 내역', () => {
  it('lists each cheer with its amount, time and a status badge that is not pressable', () => {
    const html = render([
      cheer(),
      cheer({ orderId: 'ord_2', refundedAmount: 1000, amount: { amount: 5000, currency: 'KRW' } }),
      cheer({
        orderId: 'ord_3',
        status: 'REFUNDED',
        refundedAmount: 1000,
        refundedAt: '2026-10-09T02:00:00Z',
        amount: { amount: 1000, currency: 'KRW' },
      }),
    ])
    expect(html).toContain('내 응원 내역')
    for (const text of ['3,000원', '5,000원', '1,000원', '결제됨', '일부 환불됨', '환불됨'])
      expect(html).toContain(text)
    expect(html).toContain('2026')
  })

  it('every row ends in a pressable 「자세히」 link to the payment (underlined or boxed — never bare words)', () => {
    const html = render([cheer(), cheer({ orderId: 'ord_2' })])
    const links = html.match(/<a [^>]*href="\/payments\/ord_[12]"[^>]*>/g) ?? []
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toMatch(/class="[^"]*\S+[^"]*"/) // the part's button-like class
      expect(link).toContain('aria-label="자세히: 응원하기"')
    }
    expect(html).toContain('자세히')
  })

  it('shows the card when the server sent one', () => {
    const html = render([cheer({ card: { issuer: 'HYUNDAI', last4: '1234' } })])
    expect(html).toContain('현대카드 ····1234')
  })

  it('has one filled 「응원하기」 link at the top when there are cheers', () => {
    const html = render([cheer()])
    expect(html.match(/href="\/cheer"/g)).toHaveLength(1)
  })

  it('an empty history says so and leads to 「응원하기」 (one link, in the empty state)', () => {
    const html = render([])
    expect(html).toContain('아직 응원한 내역이 없어요')
    expect(html.match(/href="\/cheer"/g)).toHaveLength(1)
  })

  it('while loading there is a spinner', () => {
    expect(render()).toContain('불러오는 중')
  })

  it('English', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render([cheer()])
    expect(html).toContain('My cheers')
    expect(html).not.toMatch(/[가-힣]/)
  })
})
