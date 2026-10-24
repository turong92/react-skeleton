import { adminKeys, type AdminOrder, type AdminRefund } from '@skeleton/payment/admin'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { OperatorSession } from '../test-support/operatorSession'
import { AdminPaymentsPage, ADMIN_PAYMENTS_PAGE_SIZE } from './AdminPaymentsPage'
import { ordersParamsOf } from './adminOrdersParams'

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
  testMode: false,
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
  orderId: 'ord_7',
  status: 'REQUESTED',
  amount: { amount: 1000, currency: 'KRW' },
  reasonCode: 'NOT_DELIVERED',
  origin: 'USER',
  requestedAt: '2026-10-09T02:00:00Z',
  completedAt: null,
  closedBy: null,
  requestedBy: 'acc_9',
  decidedBy: null,
  failureCode: null,
  ...over,
})
const page = <T,>(values: T[]) => ({
  pages: [{ values, cursor: { hasNext: false, nextCursor: null }, meta: { timestamp: 't' } }],
  pageParams: [undefined],
})

function render(url: string, seed: (client: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } })
  seed(client)
  return renderToStaticMarkup(
    <OperatorSession>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/admin/payments" element={<AdminPaymentsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </OperatorSession>,
  )
}
const size = ADMIN_PAYMENTS_PAGE_SIZE

describe('AdminPaymentsPage', () => {
  it('has three tabs — 전체, 확인 필요, 환불 요청 — and starts on the first', () => {
    const html = render('/admin/payments', (client) =>
      client.setQueryData(adminKeys.orders({ size }), page([order()])),
    )
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>전체</)
    expect(html).toContain('>확인 필요<')
    expect(html).toContain('>환불 요청<')
    expect(html).toContain('응원하기 3,000원')
  })

  it('every row leads to its payment with a real link that looks pressable', () => {
    const html = render('/admin/payments', (client) =>
      client.setQueryData(adminKeys.orders({ size }), page([order({ id: 'ord_5' })])),
    )
    expect(html).toMatch(
      /<a (?=[^>]*href="\/admin\/payments\/ord_5")(?=[^>]*aria-label="자세히: 응원하기 3,000원")[^>]*>/,
    )
    expect(html).toMatch(/<a [^>]*class="[^"]*actionLink/)
  })

  it('only the 전체 tab has the switch for payments of closed accounts (the server shows them in 확인 필요 and for an exact payment number anyway)', () => {
    const seed = (client: QueryClient) => {
      client.setQueryData(adminKeys.orders({ size }), page([order()]))
      client.setQueryData(adminKeys.orders({ review: true, size }), page([order()]))
      client.setQueryData(adminKeys.refunds({ status: 'REQUESTED', size }), page([refund()]))
    }
    expect(render('/admin/payments', seed)).toContain('탈퇴한 계정의 결제도 보기')
    expect(render('/admin/payments?tab=review', seed)).not.toContain('탈퇴한 계정의 결제도 보기')
    expect(render('/admin/payments?tab=refunds', seed)).not.toContain('탈퇴한 계정의 결제도 보기')
  })

  it('ordersParamsOf sends includeErased only when the switch is on, and never with 확인 필요', () => {
    const filter = { status: 'PAID' as const, q: 'ord_1' }
    expect(ordersParamsOf(false, filter, size)).toEqual({ status: 'PAID', q: 'ord_1', size })
    expect(ordersParamsOf(false, { ...filter, includeErased: false }, size)).toEqual({
      status: 'PAID',
      q: 'ord_1',
      size,
    })
    expect(ordersParamsOf(false, { ...filter, includeErased: true }, size)).toEqual({
      status: 'PAID',
      q: 'ord_1',
      includeErased: true,
      size,
    })
    expect(ordersParamsOf(true, { status: '', q: '', includeErased: true }, size)).toEqual({
      review: true,
      size,
    })
  })

  it('the 확인 필요 tab asks for review=true only and shows why', () => {
    const html = render('/admin/payments?tab=review', (client) =>
      client.setQueryData(
        adminKeys.orders({ review: true, size }),
        page([order({ reviewReason: 'REFUND_MISMATCH' })]),
      ),
    )
    expect(html).toMatch(/aria-selected="true"[^>]*>확인 필요</)
    expect(html).toContain('환불한 금액이 결제사와 맞지 않아요')
  })

  it('the 환불 요청 tab lists the waiting requests with their decision buttons and a link to the payment', () => {
    const html = render('/admin/payments?tab=refunds', (client) =>
      client.setQueryData(adminKeys.refunds({ status: 'REQUESTED', size }), page([refund()])),
    )
    expect(html).toMatch(/aria-selected="true"[^>]*>환불 요청</)
    expect(html).toContain('ord_7')
    expect(html).toContain('받지 못했어요')
    expect(html).toContain('aria-label="요청대로 환불하기: 1,000원 (결제 ord_7)"')
    expect(html).toContain('aria-label="요청 거절하기: 1,000원 (결제 ord_7)"')
    expect(html).toMatch(
      /<a (?=[^>]*href="\/admin\/payments\/ord_7")(?=[^>]*aria-label="결제 보기: ord_7")[^>]*>/,
    )
    // 줄마다 채운 단추를 두지 않는다 - 채운 단추는 확인 창의 확인뿐이고 그 창은 요청을 고르기 전에는 그려지지 않는다
    expect(html).not.toContain('data-variant="primary"')
    expect(html).not.toContain('<dialog') // 고르기 전에는 만들지 않는다 - 승인은 approve 만, 거절은 reject 만 부르는 배선은 useRefundDecision 스토리의 play 가 잰다
  })

  it('an unknown tab in the address is the first tab', () => {
    const html = render('/admin/payments?tab=nope', (client) =>
      client.setQueryData(adminKeys.orders({ size }), page([order()])),
    )
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>전체</)
  })

  it('only the chosen tab loads its list (the others are not drawn)', () => {
    const html = render('/admin/payments?tab=refunds', (client) =>
      client.setQueryData(adminKeys.refunds({ status: 'REQUESTED', size }), page([refund()])),
    )
    expect(html).not.toContain('결제 목록') // 결제 목록 표 이름
  })

  it('English', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render('/admin/payments?tab=refunds', (client) =>
      client.setQueryData(adminKeys.refunds({ status: 'REQUESTED', size }), page([refund()])),
    )
    expect(html).toContain('Refund requests')
    expect(html).not.toMatch(/[가-힣]/)
  })
})
