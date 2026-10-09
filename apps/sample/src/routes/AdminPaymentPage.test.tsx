import { ApiRequestError } from '@skeleton/api-client'
import {
  adminKeys,
  type AdminOrder,
  type AdminOrderDetail,
  type AdminRefund,
} from '@skeleton/payment/admin'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { AdminPaymentPage } from './AdminPaymentPage'

afterEach(async () => {
  await i18n.setLocale('ko', { remember: false })
})

const order = (over: Partial<AdminOrder> = {}): AdminOrder => ({
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
  accountId: 'acc_9',
  provider: 'toss',
  providerPaymentId: 'tgen_abc',
  reviewReason: null,
  ...over,
})
const refund = (over: Partial<AdminRefund> = {}): AdminRefund => ({
  id: 'rfd_1',
  orderId: 'ord_1',
  status: 'REQUESTED',
  amount: { amount: 3000, currency: 'KRW' },
  reasonCode: 'CUSTOMER_REQUEST',
  origin: 'USER',
  requestedAt: '2026-10-09T02:00:00Z',
  completedAt: null,
  closedBy: null,
  requestedBy: 'acc_9',
  decidedBy: null,
  failureCode: null,
  ...over,
})
const detailOf = (over: Partial<AdminOrderDetail> = {}): AdminOrderDetail => ({
  order: order(),
  refunds: [],
  events: [],
  ...over,
})

function render(seed: (client: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } })
  seed(client)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/payments/ord_1']}>
        <Routes>
          <Route path="/admin/payments/:id" element={<AdminPaymentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const withDetail = (detail: AdminOrderDetail) => (client: QueryClient) =>
  client.setQueryData(adminKeys.order('ord_1'), detail)
const failedWith = (code: string, status: number) => (client: QueryClient) => {
  const error = new ApiRequestError(
    { code, title: 't', status, timestamp: 't', traceId: 'trace-3' },
    'trace-3',
    'sp',
    'tp',
  )
  client
    .getQueryCache()
    .build(client, { queryKey: adminKeys.order('ord_1') })
    .setState({ status: 'error', error, fetchStatus: 'idle', data: undefined })
}
/** 한 번 받은 뒤 다시 읽기가 실패한 조회 - 데이터는 그대로 있고 상태만 오류다 */
const refetchFailed = (detail: AdminOrderDetail) => (client: QueryClient) => {
  const error = new ApiRequestError(
    { code: 'COMMON.TIMEOUT', title: 't', status: 504, timestamp: 't', traceId: 'trace-4' },
    'trace-4',
    'sp',
    'tp',
  )
  client
    .getQueryCache()
    .build(client, { queryKey: adminKeys.order('ord_1') })
    .setState({ status: 'error', error, fetchStatus: 'idle', data: detail })
}
const filled = (html: string) => (html.match(/data-variant="primary"/g) ?? []).length
const button = (html: string, label: string) =>
  html.match(new RegExp(`<button[^>]*>[^<]*(<[^>]*>)*${label}`))?.[0] ?? ''

describe('AdminPaymentPage', () => {
  it('shows the payment with what only an operator sees, and a way back that is a real link', () => {
    const html = render(withDetail(detailOf()))
    for (const text of ['3,000원', '현대카드 ····1234', 'acc_9', 'tgen_abc', '테스트 결제예요'])
      expect(html, text).toContain(text)
    expect(html).toMatch(/<a [^>]*href="\/admin\/payments"[^>]*>[^<]*결제 관리/)
  })

  it('a paid payment has one filled 「환불하기」 and a plain 「결제사와 맞추기」', () => {
    const html = render(withDetail(detailOf()))
    expect(button(html, '환불하기')).toContain('data-variant="primary"')
    expect(button(html, '결제사와 맞추기')).toContain('data-variant="secondary"')
  })

  it('a payment that needs a check says why and makes 「결제사와 맞추기」 the filled button', () => {
    const html = render(withDetail(detailOf({ order: order({ reviewReason: 'MODE_MISMATCH' }) })))
    expect(html).toContain('테스트 결제와 실제 결제가 섞였어요')
    expect(button(html, '결제사와 맞추기')).toContain('data-variant="primary"')
  })

  it('a waiting request has its decision buttons, and the direct refund is blocked with the reason beside it', () => {
    const html = render(
      withDetail(
        detailOf({
          order: order({ refundPending: true, openRefundStatus: 'REQUESTED' }),
          refunds: [refund()],
        }),
      ),
    )
    expect(html).toContain('요청대로 환불하기')
    expect(html).toContain('요청 거절하기')
    expect(button(html, '환불하기')).toContain('aria-disabled="true"')
    expect(html).toContain('환불 요청이 있어요. 아래에서 환불하거나 거절해 주세요')
  })

  it('the direct refund has its confirmation window in the page (closed); the request decision window is not drawn until a request is chosen', () => {
    const html = render(
      withDetail(
        detailOf({
          order: order({ refundPending: true, openRefundStatus: 'REQUESTED' }),
          refunds: [refund()],
        }),
      ),
    )
    expect(html).toContain('<dialog')
    expect(html).toContain('환불할까요?') // 직접 환불 창의 제목
    expect(html).not.toContain('요청대로 환불할까요?') // 결정 창은 고르기 전에는 없다 - 배선은 useRefundDecision 스토리의 play 가 잰다
    expect(html).not.toContain('환불 요청을 거절할까요?')
  })

  it('one filled button on the whole page in every state (the windows only have their confirm, which is not drawn open)', () => {
    const waiting = detailOf({
      order: order({ refundPending: true, openRefundStatus: 'REQUESTED' }),
      refunds: [refund()],
    })
    for (const detail of [
      detailOf(),
      waiting,
      detailOf({ order: order({ reviewReason: 'MODE_MISMATCH' }) }),
      detailOf({ order: order({ reviewReason: 'MODE_MISMATCH' }), refunds: waiting.refunds }),
    ])
      expect(filled(render(withDetail(detail)))).toBe(1)
  })

  it('a re-read that fails while the payment is on screen keeps the payment (and the window with its idempotency key) and says the numbers may be old', () => {
    const html = render(refetchFailed(detailOf()))
    expect(html).toContain('응원하기 3,000원')
    // 막힌 「환불하기」를 채우지 않는다 - 지금 누를 수 있는 일은 「결제사와 맞추기」(채운 단추는 여전히 화면에 하나)
    expect(button(html, '환불하기')).toContain('data-variant="secondary"')
    expect(filled(html)).toBe(1)
    expect(html).toContain('<dialog') // 직접 환불 창이 그대로 마운트되어 있다
    expect(html).toContain('불러오지 못했어요')
    expect(html).toContain('아래 숫자가 낡았을 수 있어요') // 서버에 연결하지 못했다는 말이 아니라, 화면이 무엇을 잃었는지
    expect(html).toMatch(/<button[^>]*>[^<]*다시 시도/)
  })

  it('a re-read that failed may be hiding a refund that just went out: the money buttons are blocked (reachable, with the reason), the retry and the plain buttons are not', () => {
    const waiting = detailOf({
      order: order({ refundPending: true, openRefundStatus: 'REQUESTED' }),
      refunds: [refund()],
    })
    for (const detail of [detailOf(), waiting]) {
      const html = render(refetchFailed(detail))
      const money =
        html.match(
          /<button[^>]*>환불하기<\/button>|<button[^>]*aria-label="요청대로 환불하기[^>]*>/,
        )?.[0] ?? ''
      expect(money).toContain('aria-disabled="true"')
      expect(money).not.toMatch(/\sdisabled/)
      expect(html).toContain('최신 내용을 불러온 뒤에')
      expect(html).toMatch(/<button[^>]*>[^<]*다시 시도/)
      expect(html).toMatch(/<button[^>]*>[^<]*결제사와 맞추기/)
    }
    // 읽기가 멀쩡하면 막지 않는다
    expect(button(render(withDetail(detailOf())), '환불하기')).not.toContain('aria-disabled')
    expect(render(withDetail(detailOf()))).not.toContain('최신 내용을')
  })

  it('a first read that fails still replaces the screen with the load error and a retry', () => {
    const html = render(failedWith('COMMON.INTERNAL', 500))
    expect(html).toContain('불러오지 못했어요')
    expect(html).toContain('trace-3')
    expect(html).not.toContain('환불하기')
  })

  it('a payment that is not there says so and leads back to the list', () => {
    const html = render(failedWith('PAYMENT.ORDER_NOT_FOUND', 404))
    expect(html).toContain('찾을 수 없는 결제예요')
    expect(html).toMatch(/<a [^>]*href="\/admin\/payments"/)
  })

  it('403 is the blocked notice (no sign-out); a 404 that is not about this payment says the operator tools are off', () => {
    expect(render(failedWith('COMMON.FORBIDDEN', 403))).toContain('접근')
    const off = render(failedWith('COMMON.NOT_FOUND', 404))
    expect(off).toContain('결제 관리를 쓸 수 없어요')
    expect(off).not.toContain('찾을 수 없는 결제예요')
  })

  it('English', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render(withDetail(detailOf({ order: order({ orderName: 'Cheer 3,000 KRW' }) })))
    expect(html).toContain('Payments')
    expect(html).toContain('Match with the provider')
    expect(html).not.toMatch(/[가-힣]/)
    const old = render(refetchFailed(detailOf({ order: order({ orderName: 'Cheer 3,000 KRW' }) })))
    expect(old).toContain('may be out of date')
    expect(old).toContain('You can refund once the latest details have loaded')
    expect(old).not.toMatch(/[가-힣]/)
  })
})
