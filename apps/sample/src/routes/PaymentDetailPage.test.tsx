import { ApiRequestError } from '@skeleton/api-client'
import {
  paymentKeys,
  type Order,
  type OrderDetail,
  type PaymentConfig,
  type Refund,
} from '@skeleton/payment'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { PaymentDetailPage } from './PaymentDetailPage'

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
const refund = (over: Partial<Refund> = {}): Refund => ({
  id: 'rfd_1',
  orderId: 'ord_1',
  status: 'REQUESTED',
  amount: { amount: 3000, currency: 'KRW' },
  reasonCode: 'CUSTOMER_REQUEST',
  origin: 'USER',
  requestedAt: '2026-10-09T02:00:00Z',
  completedAt: null,
  closedBy: null,
  ...over,
})
const config: PaymentConfig = { available: true, testMode: true, refundRequestsEnabled: true }

function render(seed: (client: QueryClient) => void) {
  // 오류로 시드한 조회가 그리는 순간 다시 가져오는 중(pending)으로 보이지 않게
  const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } })
  client.setQueryData(paymentKeys.config(), config)
  seed(client)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/payments/ord_1']}>
        <Routes>
          <Route path="/payments/:id" element={<PaymentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const withDetail = (detail: OrderDetail) => (client: QueryClient) =>
  client.setQueryData(paymentKeys.order('ord_1'), detail)

describe('PaymentDetailPage', () => {
  it('shows the payment: amount, card, the test-payment notice, and a way back that is a real link', () => {
    const html = render(withDetail({ order: order(), refunds: [] }))
    expect(html).toContain('3,000원')
    expect(html).toContain('현대카드 ····1234')
    expect(html).toContain('테스트 결제예요')
    expect(html).toMatch(/<a [^>]*href="\/cheers"[^>]*>[^<]*내 응원 내역/)
  })

  it('a subscription payment goes back to 「내 구독」, not to the cheer list', () => {
    const html = render(withDetail({ order: order({ itemType: 'subscription' }), refunds: [] }))
    expect(html).toMatch(/<a [^>]*href="\/subscription"[^>]*>[^<]*내 구독/)
    expect(html).not.toContain('내 응원 내역')
  })

  it('a paid cheer has a filled 「환불 요청」 button that can be pressed', () => {
    const html = render(withDetail({ order: order(), refunds: [] }))
    const button = html.match(/<button[^>]*data-variant="primary"[^>]*>[^<]*환불 요청/)?.[0] ?? ''
    expect(button).not.toBe('')
    expect(button).not.toContain('aria-disabled')
  })

  it('after asking, the badge reads 「환불 요청함」 and the button stays reachable with the reason beside it', () => {
    const html = render(
      withDetail({
        order: order({ openRefundStatus: 'REQUESTED', refundPending: true }),
        refunds: [refund()],
      }),
    )
    expect(html).toContain('환불 요청함')
    const button =
      html.match(/<button[^>]*data-variant="primary"[^>]*>[^<]*환불 요청<\/button>/)?.[0] ?? ''
    expect(button).toContain('aria-disabled="true"')
    expect(html).toContain('이미 환불을 요청했어요')
    expect(html).toContain('요청 거두기') // my request can be taken back
  })

  it('a refunded cheer reads 「환불됨」 and offers no refund request', () => {
    const html = render(
      withDetail({
        order: order({ status: 'REFUNDED', refundedAmount: 3000, refundableAmount: 0 }),
        refunds: [
          refund({
            status: 'SUCCEEDED',
            origin: 'OPERATOR',
            reasonCode: 'OPERATOR',
            completedAt: '2026-10-09T03:00:00Z',
          }),
        ],
      }),
    )
    expect(html).toContain('환불됨')
    expect(html).not.toMatch(/<button[^>]*>[^<]*환불 요청<\/button>/)
  })

  it('a payment that is not yours (or not there) says so and leads back to the list', () => {
    const html = render((client) => {
      const error = new ApiRequestError(
        { code: 'PAYMENT.ORDER_NOT_FOUND', title: 'not found', status: 404, timestamp: 't' },
        'tr',
        'sp',
        'tp',
      )
      client
        .getQueryCache()
        .build(client, { queryKey: paymentKeys.order('ord_1') })
        .setState({ status: 'error', error, fetchStatus: 'idle', data: undefined })
    })
    expect(html).toContain('찾을 수 없는 결제예요')
    expect(html).toMatch(/<a [^>]*href="\/cheers"/)
  })

  it('a re-read that fails while the payment is on screen keeps the payment (and the refund request window with its key)', () => {
    const html = render((client) => {
      const error = new ApiRequestError(
        { code: 'COMMON.TIMEOUT', title: 't', status: 504, timestamp: 't' },
        'tr',
        'sp',
        'tp',
      )
      client
        .getQueryCache()
        .build(client, { queryKey: paymentKeys.order('ord_1') })
        .setState({
          status: 'error',
          error,
          fetchStatus: 'idle',
          data: { order: order(), refunds: [] },
        })
    })
    expect(html).toContain('<dialog')
    expect(html).toMatch(/<button[^>]*>[^<]*환불 요청<\/button>/)
  })

  it('a re-read that failed may be hiding a request that was just made: it says the page may be old and does not offer a second request until it has loaded again', () => {
    const html = render((client) => {
      const error = new ApiRequestError(
        { code: 'COMMON.TIMEOUT', title: 't', status: 504, timestamp: 't' },
        'tr',
        'sp',
        'tp',
      )
      client
        .getQueryCache()
        .build(client, { queryKey: paymentKeys.order('ord_1') })
        .setState({
          status: 'error',
          error,
          fetchStatus: 'idle',
          data: { order: order(), refunds: [] },
        })
    })
    expect(html).toContain('아래 내용이 낡았을 수 있어요')
    expect(html).toMatch(/<button[^>]*>[^<]*다시 시도/)
    const button =
      html.match(/<button[^>]*data-variant="primary"[^>]*>[^<]*환불 요청<\/button>/)?.[0] ?? ''
    expect(button).toContain('aria-disabled="true"')
    expect(button).not.toMatch(/\sdisabled/)
    expect(html).toContain('최신 내용을 불러온 뒤에 요청할 수 있어요')
  })

  it('English', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render(withDetail({ order: order({ orderName: 'Cheer 3,000 KRW' }), refunds: [] }))
    expect(html).toContain('My cheers')
    expect(html).not.toMatch(/[가-힣]/)
  })
})
