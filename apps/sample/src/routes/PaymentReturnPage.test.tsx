import { paymentKeys, type Order, type OrderDetail, type PaymentConfig } from '@skeleton/payment'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { PaymentReturnPage } from './PaymentReturnPage'

afterEach(async () => {
  await i18n.setLocale('ko', { remember: false })
})

const order = (over: Partial<Order> = {}): Order => ({
  id: 'ord_1',
  status: 'PAID',
  kind: 'ONE_TIME',
  itemType: 'cheer',
  itemRef: 'cheer-3000',
  quantity: 1,
  orderName: '응원하기 3,000원',
  amount: { amount: 3000, currency: 'KRW' },
  refundedAmount: 0,
  refundableAmount: 3000,
  refundPending: false,
  openRefundStatus: null,
  method: 'CARD',
  card: { issuer: 'HYUNDAI', last4: '1234' },
  testMode: true,
  failureCode: null,
  createdAt: '2026-10-09T01:00:00Z',
  paidAt: '2026-10-09T01:00:05Z',
  fulfilled: true,
  ...over,
})
const config: PaymentConfig = { available: true, testMode: true, refundRequestsEnabled: true }

function render(search: string, detail?: Order) {
  const client = new QueryClient()
  client.setQueryData(paymentKeys.config(), config)
  if (detail)
    client.setQueryData(paymentKeys.order(detail.id), {
      order: detail,
      refunds: [],
    } satisfies OrderDetail)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/payments/return${search}`]}>
        <PaymentReturnPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const SUCCESS = '?paymentKey=pk_1&orderId=ord_1&amount=3000'

describe('PaymentReturnPage', () => {
  it('a paid order says so, with the card and a way on to 「내 응원 내역」', () => {
    const html = render(SUCCESS, order())
    expect(html).toContain('결제됐어요')
    expect(html).toContain('현대카드 ····1234')
    expect(html).toContain('내 응원 내역')
    expect(html).toContain('테스트 결제예요')
  })

  it('an order still being confirmed says 「결제 확인 중」 and does not offer a second payment', () => {
    const html = render(SUCCESS, order({ status: 'CONFIRMING', paidAt: null, card: null }))
    expect(html).toContain('결제 확인 중이에요')
    expect(html).not.toContain('다시 해 보기')
  })

  it('a window the person closed reads 「그만뒀어요」 and offers to try again', () => {
    const html = render(
      '?code=PAY_PROCESS_CANCELED&message=x&orderId=ord_1',
      order({ status: 'CANCELED', paidAt: null, card: null }),
    )
    expect(html).toContain('결제를 그만뒀어요')
    expect(html).toContain('다시 해 보기')
  })

  it('a window that came back with a failure reads 「결제가 안 됐어요」, not 「그만뒀어요」', () => {
    const html = render(
      '?code=REJECT_CARD_COMPANY&message=x&orderId=ord_1',
      order({ status: 'CANCELED', paidAt: null, card: null }),
    )
    expect(html).toContain('결제가 안 됐어요')
    expect(html).not.toContain('그만뒀어요')
  })

  it('a window that was closed says so at once from the address alone — it never claims to be checking, even before (or without) the order being read', () => {
    for (const cached of [undefined, order({ status: 'PENDING', paidAt: null, card: null })]) {
      const html = render('?order=ord_1&code=PAY_PROCESS_CANCELED&message=x', cached)
      expect(html).toContain('결제를 그만뒀어요')
      expect(html).not.toContain('확인 중')
      expect(html).not.toContain('확인이 늦어지고')
    }
  })

  it('a failure the window reported reads 「결제가 안 됐어요」 from the address alone, with a way to try again', () => {
    for (const cached of [undefined, order({ status: 'PENDING', paidAt: null, card: null })]) {
      const html = render('?order=ord_1&code=REJECT_CARD_COMPANY&message=x', cached)
      expect(html).toContain('결제가 안 됐어요')
      expect(html).not.toContain('확인 중')
    }
  })

  it('while the server has not yet said what became of the order, 「다시 해 보기」 is held back (a second payment could double charge); once read, it comes', () => {
    const search = '?order=ord_1&code=PAY_PROCESS_CANCELED&message=x'
    const pending = render(search)
    expect(pending).toContain('결제를 그만뒀어요')
    expect(pending).not.toContain('다시 해 보기')
    expect(pending).toContain('내 응원 내역')
    const read = render(search, order({ status: 'PENDING', paidAt: null, card: null }))
    expect(read).toContain('다시 해 보기')
  })

  it('when reading the order fails, the server still has not said what became of it — 「다시 해 보기」 stays held back', () => {
    // 서버 렌더는 오류 난 조회를 마운트 때 다시 읽으려는 것으로(=기다림) 그린다; 마운트 뒤 실패로 끝난 모습을 재려고 끈다
    const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } })
    client.setQueryData(paymentKeys.config(), config)
    client
      .getQueryCache()
      .build(client, { queryKey: paymentKeys.order('ord_1') })
      .setState({ status: 'error', error: new Error('boom'), fetchStatus: 'idle' })
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/payments/return?order=ord_1&code=PAY_PROCESS_CANCELED']}>
          <PaymentReturnPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(html).toContain('결제를 그만뒀어요')
    expect(html).not.toContain('다시 해 보기')
    expect(html).toContain('내 응원 내역')
  })

  it('the left-screen buttons sit in a spaced row — one filled, one outlined — and the test-payment notice shows', () => {
    const html = render('?code=PAY_PROCESS_CANCELED&message=x')
    expect(html).toContain('테스트 결제예요')
    expect(html).toMatch(/<button[^>]*data-variant="primary"[^>]*>[^<]*다시 해 보기/)
    expect(html).toMatch(/<button[^>]*data-variant="secondary"[^>]*>[^<]*내 응원 내역/)
    // 두 단추가 `.actions` 묶음 안에 있다(간격은 그 묶음의 gap)
    expect(html).toMatch(
      /<div class="[^"]*actions[^"]*">\s*<button[^>]*>다시 해 보기<\/button><button[^>]*>내 응원 내역/,
    )
  })

  it('a failure address without any order id is still a readable address — it says 「그만뒀어요」, not that the address is wrong', () => {
    const html = render('?code=PAY_PROCESS_CANCELED&message=x')
    expect(html).toContain('결제를 그만뒀어요')
    expect(html).toContain('다시 해 보기')
    expect(html).not.toContain('주소가 올바르지 않아요')
    expect(html).toMatch(/<a [^>]*href="\/cheers"|<button[^>]*>[^<]*내 응원 내역/)
  })

  it('a failure address never hides what the server says: an order that is in fact paid reads 「결제됐어요」', () => {
    const html = render('?order=ord_1&code=PAY_PROCESS_CANCELED&message=x', order())
    expect(html).toContain('결제됐어요')
    expect(html).not.toContain('그만뒀어요')
  })

  it('an address that is not a payment return says so and leads to 「내 응원 내역」 (nothing is sent)', () => {
    for (const search of ['', '?paymentKey=pk_1&amount=oops']) {
      const html = render(search)
      expect(html, search).toContain('결제 결과를 읽지 못했어요')
      expect(html, search).toMatch(/<a [^>]*href="\/cheers"/)
    }
  })

  it('English', async () => {
    await i18n.setLocale('en', { remember: false })
    // 주문 이름은 서버가 정한 글자라 그대로 보인다 — 영어 서버의 이름으로
    const html = render(SUCCESS, order({ orderName: 'Cheer 3,000 KRW' }))
    expect(html).toContain('Payment result')
    expect(html).not.toMatch(/[가-힣]/)
  })
})
