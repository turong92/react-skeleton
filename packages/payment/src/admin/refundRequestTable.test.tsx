import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from '../labels'
import { adminRefund } from '../test/fixtures'
import { RefundRequestTable } from './RefundRequestTable'

const common = { labels: koPaymentLabels, locale: 'ko-KR', formatTime: () => '2026. 1. 1.' }
const noop = () => undefined
const html = (props: Partial<ComponentProps<typeof RefundRequestTable>>) =>
  renderToStaticMarkup(<RefundRequestTable {...common} refunds={[]} {...props} />)

const rows = [
  adminRefund({ id: 'rfd_1', orderId: 'ord_1', amount: { amount: 3000, currency: 'KRW' } }),
  adminRefund({
    id: 'rfd_2',
    orderId: 'ord_2',
    amount: { amount: 1000, currency: 'KRW' },
    reasonCode: 'NOT_DELIVERED',
  }),
]

describe('RefundRequestTable', () => {
  it('is a table named 환불 요청 목록: payment number, amount, reason in words, time, status', () => {
    const out = html({ refunds: rows })
    expect(out).toContain('<table')
    expect(out).toContain('환불 요청 목록')
    for (const text of [
      'ord_1',
      '3,000원',
      '1,000원',
      '마음이 바뀌었어요',
      '받지 못했어요',
      '2026. 1. 1.',
      '환불 요청함',
    ])
      expect(out, text).toContain(text)
    expect(out).not.toContain('CUSTOMER_REQUEST')
  })

  it('every waiting request has its own pressable actions named after the amount and the payment: plain (outlined) 요청대로 환불하기, 요청 거절하기 and 결제 보기 - no filled button per row', () => {
    const out = html({ refunds: rows, onApprove: noop, onReject: noop, onOpenOrder: noop })
    const body = out.match(/<tbody>[\s\S]*<\/tbody>/)?.[0] ?? ''
    expect(body.match(/<button/g)).toHaveLength(6)
    expect(out).toContain('aria-label="요청대로 환불하기: 3,000원 (결제 ord_1)"')
    expect(out).toContain('aria-label="요청 거절하기: 1,000원 (결제 ord_2)"')
    expect(out).toContain('aria-label="결제 보기: ord_2"')
    // 줄마다 채운 단추를 두면 20줄이면 20개다 - 채운 단추는 화면에 하나뿐이고 그것은 확인 창의 몫
    expect(body).not.toContain('data-variant="primary"')
    expect(body.match(/data-variant="secondary"/g)).toHaveLength(6)
    expect(body).not.toMatch(/data-variant="(ghost|link)"/) // 글자만 있는 단추 없음
    expect(out).not.toMatch(/<tr[^>]*(onclick|role="button"|tabindex)/i)
  })

  it('only a request still waiting gets the decide buttons; a finished one only shows its status', () => {
    const out = html({
      refunds: [adminRefund({ id: 'rfd_9', status: 'SUCCEEDED' })],
      onApprove: noop,
      onReject: noop,
    })
    expect(out).toContain('환불됨')
    expect(out).not.toContain('요청대로 환불하기')
    expect(out).not.toContain('요청 거절하기')
  })

  it('draws no button for an action nobody handles (read-only use)', () => {
    expect(html({ refunds: rows })).not.toContain('<button')
  })

  it('renderAction swaps the 결제 보기 control for a router link with the pressable class', () => {
    const out = html({
      refunds: rows,
      renderAction: (refund, label, name, cls) => (
        <a href={`/admin/payments/${refund.orderId}`} className={cls} aria-label={name}>
          {label}
        </a>
      ),
    })
    expect(out).toContain('href="/admin/payments/ord_1"')
    expect(out).toMatch(/class="[^"]*actionLink[^"]*"/i)
    expect(out).toContain('>결제 보기<')
  })

  it('empty, loading, error and 더 보기 behave like the other lists', () => {
    expect(html({})).toContain('결정을 기다리는 환불 요청이 없어요')
    expect(html({ refunds: rows, loading: true })).toContain('불러오는 중')
    const failed = html({ refunds: rows, error: true, onRetry: noop })
    expect(failed).toContain('3,000원')
    expect(failed).toContain('다시 불러오기')
    expect(html({ refunds: rows, onLoadMore: noop })).toContain('더 보기')
  })

  it('a reason this package has not heard of draws nothing (never the raw code)', () => {
    const out = html({ refunds: [adminRefund({ reasonCode: 'SOMETHING_NEW' })] })
    expect(out).not.toContain('SOMETHING_NEW')
  })
})

describe('RefundRequestTable - a provider that cannot refund from the server', () => {
  const blocked = [
    adminRefund({ id: 'rfd_1', orderId: 'ord_1', refundBlock: 'UNSUPPORTED' }),
    adminRefund({ id: 'rfd_2', orderId: 'ord_2', refundBlock: 'PROVIDER_OFF' }),
    adminRefund({ id: 'rfd_3', orderId: 'ord_3', refundBlock: 'MODE_MISMATCH' }),
    adminRefund({ id: 'rfd_4', orderId: 'ord_4', refundBlock: null }),
  ]

  it('the approve button of a blocked line cannot be pressed and the reason sits next to it; declining stays open', () => {
    let approved = 0
    const out = html({ refunds: blocked, onApprove: () => (approved += 1), onReject: noop })
    for (const reason of [
      '이 결제사는 서버에서 환불할 수 없어요 — 결제사 관리 화면에서 환불한 뒤 요청을 거절하세요',
      '결제사가 지금 꺼져 있어요',
      '키 모드가 달라요',
    ])
      expect(out, reason).toContain(reason)
    const approve = (id: string) =>
      out.match(
        new RegExp(`<button[^>]*aria-label="요청대로 환불하기: [^"]*\\(결제 ${id}\\)"[^>]*>`),
      )?.[0] ?? ''
    for (const id of ['ord_1', 'ord_2', 'ord_3']) {
      const button = approve(id)
      expect(button, id).toContain('aria-disabled="true"')
      expect(button, id).toMatch(/aria-describedby="[^"]+"/)
    }
    expect(approve('ord_4')).not.toContain('aria-disabled')
    // 거절은 막지 않는다
    expect(
      out
        .match(/aria-label="요청 거절하기[^"]*"[^>]*>/g)
        ?.every((tag) => !tag.includes('aria-disabled')),
    ).toBe(true)
    expect(approved).toBe(0)
  })
})
