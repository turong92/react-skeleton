import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from '../labels'
import { adminOrder } from '../test/fixtures'
import { AdminOrderTable } from './AdminOrderTable'

const common = { labels: koPaymentLabels, locale: 'ko-KR', formatTime: () => '2026. 1. 1.' }
const noop = () => undefined
const html = (props: Partial<ComponentProps<typeof AdminOrderTable>>) =>
  renderToStaticMarkup(<AdminOrderTable {...common} orders={[]} {...props} />)

const rows = [
  adminOrder({ id: 'ord_1', orderName: '응원하기 3,000원' }),
  adminOrder({
    id: 'ord_2',
    orderName: '응원하기 1,000원',
    amount: { amount: 1000, currency: 'KRW' },
    status: 'CONFIRMING',
    card: null,
    method: 'EASY_PAY',
    reviewReason: 'CONFIRM_UNRESOLVED',
  }),
]

describe('AdminOrderTable', () => {
  it('is a real table named 결제 목록 with a 자세히 button per row named after the row (the row itself is not a control)', () => {
    const out = html({ orders: rows, onOpen: noop })
    expect(out).toContain('<table')
    expect(out).toContain('결제 목록')
    expect(out.match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<button/g)).toHaveLength(2)
    expect(out).toContain('aria-label="자세히: 응원하기 3,000원"')
    expect(out).not.toMatch(/<tr[^>]*(onclick|role="button"|tabindex)/i)
  })

  it('shows name, payment number, amount, card display (or the kind of payment), status and time', () => {
    const out = html({ orders: rows, onOpen: noop })
    for (const text of [
      '응원하기 3,000원',
      'ord_1',
      '3,000원',
      '현대카드 ····1234',
      '간편결제',
      '결제됨',
      '결제 확인 중',
      '2026. 1. 1.',
    ])
      expect(out, text).toContain(text)
  })

  it('marks an order that needs a check with 확인 필요 and says why in words (never the code)', () => {
    const out = html({ orders: rows, onOpen: noop })
    expect(out).toContain('확인 필요')
    expect(out).toContain('결제 결과를 끝내 확인하지 못했어요')
    expect(out).not.toContain('CONFIRM_UNRESOLVED')
    const clean = html({ orders: [rows[0]!], onOpen: noop })
    expect(clean).not.toContain('확인 필요')
  })

  it('a reason this package has not heard of is a neutral phrase, not the raw code', () => {
    const out = html({ orders: [adminOrder({ reviewReason: 'SOMETHING_NEW' })], onOpen: noop })
    expect(out).toContain('확인이 필요한 일이 있어요')
    expect(out).not.toContain('SOMETHING_NEW')
  })

  it('shows 환불 요청함 / 환불 중 in the status, like the user list does', () => {
    const out = html({
      orders: [adminOrder({ refundPending: true, openRefundStatus: 'REQUESTED' })],
      onOpen: noop,
    })
    expect(out).toContain('환불 요청함')
  })

  it('draws no account id (that is for the one-payment panel)', () => {
    expect(html({ orders: rows, onOpen: noop })).not.toContain('acc_1')
  })

  it('says 탈퇴한 계정 on a payment the server says was closed (accountErasedAt), even though the id is the original one', () => {
    const closed = adminOrder({ id: 'ord_9', accountErasedAt: '2026-01-01T00:00:00Z' })
    expect(html({ orders: [closed, rows[0]!], onOpen: noop }).match(/탈퇴한 계정/g)).toHaveLength(1)
  })

  it('says 탈퇴한 계정 on a payment whose account id is the closed-account stand-in, and on no other row', () => {
    const closed = adminOrder({ id: 'ord_9', accountId: 'deleted:3f9a1c0b7d2e4a55' })
    const out = html({ orders: [closed, rows[0]!], onOpen: noop })
    expect(out.match(/탈퇴한 계정/g)).toHaveLength(1)
    // 대체 값 자체는 이 표에 그리지 않는다(계정 id 는 한 건 화면에서 본다)
    expect(out).not.toContain('deleted:')
  })

  it('offers the closed-account switch only when asked, and it shows what the filter says (a real switch, named after what it does, with its hint)', () => {
    const base = { orders: rows, onOpen: noop, onFilterChange: noop }
    expect(html({ ...base, filter: { status: '', q: '' } })).not.toContain('role="switch"')
    expect(html({ ...base, showErasedToggle: true })).not.toContain('role="switch"') // 조건이 없으면 켤 곳도 없다
    const off = html({ ...base, filter: { status: '', q: '' }, showErasedToggle: true })
    expect(off).toContain('role="switch"')
    expect(off).toContain('탈퇴한 계정의 결제도 보기')
    expect(off).toContain(
      '탈퇴한 계정의 결제는 기본으로 숨겨요. 확인 필요 탭과 결제 번호 찾기에서는 늘 보여요',
    )
    expect(off).not.toMatch(/role="switch"[^>]*checked/)
    const on = html({
      ...base,
      filter: { status: '', q: '', includeErased: true },
      showErasedToggle: true,
    })
    expect(on).toMatch(/role="switch"[^>]*checked|checked[^>]*role="switch"/)
  })

  it('renderAction swaps the control and hands over the pressable link class', () => {
    const out = html({
      orders: rows,
      renderAction: (order, label, name, cls) => (
        <a href={`/admin/payments/${order.id}`} className={cls} aria-label={name}>
          {label}
        </a>
      ),
    })
    expect(out).toContain('href="/admin/payments/ord_1"')
    expect(out).toMatch(/class="[^"]*actionLink[^"]*"/i)
    expect(out).toContain('>자세히<')
  })

  it('has a filter row only when asked: a status select with every status, and a search for the payment number', () => {
    expect(html({ orders: rows, onOpen: noop })).not.toContain('role="search"')
    const out = html({
      orders: rows,
      onOpen: noop,
      filter: { status: '', q: '' },
      onFilterChange: noop,
    })
    expect(out).toContain('role="search"')
    expect(out).toContain('모든 상태')
    expect(out).toContain('일부 환불됨')
    expect(out).toContain('결제 번호')
    expect(out).toContain('>찾기<')
    expect(out).toContain('type="submit"')
  })

  it('an empty list says so, and says "none matches" when a filter is on', () => {
    expect(html({})).toContain('아직 결제가 없어요')
    const filtered = html({ filter: { status: 'PAID', q: '' }, onFilterChange: noop })
    expect(filtered).toContain('찾는 결제가 없어요')
    expect(filtered).not.toContain('아직 결제가 없어요')
    // 조건 줄은 결과가 없어도 남는다 — 조건을 고칠 수 있어야 한다
    expect(filtered).toContain('role="search"')
  })

  it('loading and error keep the rows already received; error offers 다시 불러오기', () => {
    const out = html({ orders: rows, onOpen: noop, loading: true })
    expect(out).toContain('응원하기 3,000원')
    expect(out).toContain('불러오는 중')
    const failed = html({ orders: rows, onOpen: noop, error: true, onRetry: noop })
    expect(failed).toContain('응원하기 3,000원')
    expect(failed).toContain('목록을 불러오지 못했어요')
    expect(failed).toContain('다시 불러오기')
  })

  it('a 더 보기 button only when there is a next page', () => {
    expect(html({ orders: rows, onOpen: noop })).not.toContain('더 보기')
    expect(html({ orders: rows, onOpen: noop, onLoadMore: noop })).toContain('더 보기')
  })

  it('an unknown status gets 확인 필요 and never the raw code (same as the user badge)', () => {
    const out = html({ orders: [adminOrder({ status: 'SOMETHING' as never })], onOpen: noop })
    expect(out).toContain('확인 필요')
    expect(out).not.toContain('SOMETHING')
  })

  it('marks an exempt order 결제 면제 and a free (coupon) order 무료(쿠폰); a normal order has neither', () => {
    const exempt = adminOrder({
      id: 'ord_e',
      provider: 'exempt',
      settlement: 'EXEMPT',
      amount: { amount: 0, currency: 'KRW' },
    })
    const free = adminOrder({
      id: 'ord_f',
      provider: 'free',
      settlement: 'FREE',
      amount: { amount: 0, currency: 'KRW' },
    })
    const out = html({ orders: [exempt, free, rows[0]!], onOpen: noop })
    expect(out.match(/결제 면제/g)).toHaveLength(1)
    expect(out.match(/무료\(쿠폰\)/g)).toHaveLength(1)
    expect(html({ orders: [rows[0]!], onOpen: noop })).not.toMatch(/결제 면제|무료\(쿠폰\)/)
  })

  it('the settlement filter offers 결제 면제 and reports it', () => {
    const out = html({
      orders: [],
      filter: { status: '', q: '', settlement: 'EXEMPT' },
      onFilterChange: noop,
    })
    expect(out).toContain('결제 방식')
    expect(out).toMatch(/<option value="EXEMPT" selected/)
  })
})
