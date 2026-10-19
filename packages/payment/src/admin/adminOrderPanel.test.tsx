import { ApiRequestError } from '@skeleton/api-client'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultPaymentLabels, koPaymentLabels } from '../labels'
import { adminOrder, adminRefund, paymentEvent } from '../test/fixtures'
import { AdminOrderPanel } from './AdminOrderPanel'
import type { AdminOrderDetail } from './types'

const common = { labels: koPaymentLabels, locale: 'ko-KR', formatTime: () => '2026. 1. 1.' }
const noop = () => undefined
const failed = (code: string, status: number) =>
  new ApiRequestError(
    { code, title: 't', status, timestamp: 't', traceId: 'trace-9' },
    'trace-9',
    'sp',
    'tp',
  )

const detail = (over: Partial<AdminOrderDetail> = {}): AdminOrderDetail => ({
  order: adminOrder(),
  refunds: [],
  events: [],
  ...over,
})
const panel = (d: AdminOrderDetail, props: Partial<ComponentProps<typeof AdminOrderPanel>> = {}) =>
  renderToStaticMarkup(<AdminOrderPanel {...common} detail={d} {...props} />)

/** 맞추기가 깨끗하게 끝났다(남은 사유 없음) */
const clean = { reviewReason: null }

const buttonOf = (html: string, label: string) =>
  html.match(new RegExp(`<button[^>]*>[^<]*(<[^>]*>)*${label}`))?.[0] ?? ''

describe('AdminOrderPanel — the facts', () => {
  it('names the payment and shows what only an operator sees: payment number, account, provider and its payment number', () => {
    const html = panel(detail({ order: adminOrder({ orderName: '응원하기 3,000원' }) }))
    for (const text of [
      '응원하기 3,000원',
      '결제됨',
      '결제 번호',
      'ord_1',
      '계정',
      'acc_1',
      '결제사',
      'toss',
      '결제사 결제 번호',
      'tgen_9f8e7d',
      '3,000원',
      '현대카드 ····1234',
      '2026. 1. 1.',
    ])
      expect(html, text).toContain(text)
  })

  it('shows what was refunded and what is left only when there is something', () => {
    const none = panel(detail())
    expect(none).toContain('환불할 수 있는 금액')
    expect(none).not.toContain('환불된 금액')
    const part = panel(
      detail({
        order: adminOrder({
          status: 'PARTIALLY_REFUNDED',
          refundedAmount: 1000,
          refundableAmount: 2000,
        }),
      }),
    )
    expect(part).toContain('환불된 금액')
    expect(part).toContain('1,000원')
    expect(part).toContain('2,000원')
  })

  it('a test payment says so (the same notice as the user screens)', () => {
    expect(panel(detail({ order: adminOrder({ testMode: true }) }))).toContain('테스트 결제예요')
    expect(panel(detail())).not.toContain('테스트 결제예요')
  })

  it('why a payment did not go through is a reference (code) with its copy button, not a sentence', () => {
    const html = panel(
      detail({ order: adminOrder({ status: 'FAILED', failureCode: 'REJECT_CARD_COMPANY' }) }),
    )
    expect(html).toContain('이유 코드')
    expect(html).toContain('REJECT_CARD_COMPANY')
  })
})

describe('AdminOrderPanel — needs a check', () => {
  it('says 확인 필요, why in words (never the code) and what to press', () => {
    const html = panel(detail({ order: adminOrder({ reviewReason: 'AMOUNT_MISMATCH' }) }), {
      onSync: noop,
    })
    expect(html).toContain('확인 필요')
    expect(html).toContain('결제사가 받은 금액이 결제 금액과 달라요')
    expect(html).toContain('「결제사와 맞추기」를 누르면')
    expect(html).not.toContain('AMOUNT_MISMATCH')
    const clean = panel(detail(), { onSync: noop })
    expect(clean).not.toContain('확인 필요')
    expect(clean).not.toContain('「결제사와 맞추기」를 누르면')
  })

  it('a reason this package has not heard of is a neutral phrase', () => {
    const html = panel(detail({ order: adminOrder({ reviewReason: 'SOMETHING_NEW' }) }))
    expect(html).toContain('확인이 필요한 일이 있어요')
    expect(html).not.toContain('SOMETHING_NEW')
  })

  it('when a check is needed, 결제사와 맞추기 is the one filled button and the refund is plain; otherwise the other way round', () => {
    const needs = panel(detail({ order: adminOrder({ reviewReason: 'REFUND_MISMATCH' }) }), {
      onSync: noop,
      onRefund: noop,
    })
    expect(buttonOf(needs, '결제사와 맞추기')).toContain('data-variant="primary"')
    expect(buttonOf(needs, '환불하기')).toContain('data-variant="secondary"')
    const fine = panel(detail(), { onSync: noop, onRefund: noop })
    expect(buttonOf(fine, '환불하기')).toContain('data-variant="primary"')
    expect(buttonOf(fine, '결제사와 맞추기')).toContain('data-variant="secondary"')
  })
})

describe('AdminOrderPanel — money that is off from the provider: the server refuses the refund, so the buttons that send money are held (M-4)', () => {
  const waiting = [adminRefund({ id: 'rfd_1', status: 'REQUESTED' })]
  const all = { onSync: noop, onRefund: noop, onApprove: noop, onReject: noop }
  const off = ['REFUND_MISMATCH', 'AMOUNT_MISMATCH', 'ORDER_MISMATCH', 'MODE_MISMATCH']

  it.each(off)(
    '%s: 환불하기 is held (aria-disabled, reachable) with the reason 먼저 결제사와 맞춰 주세요 read as its description, and 결제사와 맞추기 is the one filled button',
    (reviewReason) => {
      const html = panel(detail({ order: adminOrder({ reviewReason }) }), all)
      const refund = buttonOf(html, '환불하기')
      expect(refund).toContain('aria-disabled="true"')
      expect(refund).not.toMatch(/\sdisabled/)
      const id = refund.match(/aria-describedby="([^"]+)"/)?.[1]
      expect(html).toMatch(new RegExp(`id="${id}"[^>]*>먼저 결제사와 맞춰 주세요`))
      expect(buttonOf(html, '결제사와 맞추기')).toContain('data-variant="primary"')
      expect(buttonOf(html, '결제사와 맞추기')).not.toContain('aria-disabled')
      expect((html.match(/data-variant="primary"/g) ?? []).length).toBe(1)
    },
  )

  it('a waiting request cannot be approved either: 요청대로 환불하기 is held with the same reason, 요청 거절하기 (no money goes out) stays live, and the sync is the filled one', () => {
    const html = panel(
      detail({
        order: adminOrder({
          reviewReason: 'REFUND_MISMATCH',
          refundPending: true,
          openRefundStatus: 'REQUESTED',
        }),
        refunds: waiting,
      }),
      all,
    )
    const approve = html.match(/<button[^>]*aria-label="요청대로 환불하기[^"]*"[^>]*>/)?.[0] ?? ''
    expect(approve).toContain('aria-disabled="true"')
    const id = approve.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(html).toMatch(new RegExp(`id="${id}"[^>]*>먼저 결제사와 맞춰 주세요`))
    expect(html.match(/<button[^>]*aria-label="요청 거절하기[^"]*"[^>]*>/)?.[0]).not.toContain(
      'aria-disabled',
    )
    expect(buttonOf(html, '결제사와 맞추기')).toContain('data-variant="primary"')
    expect((html.match(/data-variant="primary"/g) ?? []).length).toBe(1)
  })

  it('a reason about something else (the result, the delivery, a stuck line) does not hold the refund', () => {
    for (const reviewReason of ['CONFIRM_UNRESOLVED', 'FULFILMENT_UNRESOLVED', 'STALE_REFUND']) {
      const html = panel(detail({ order: adminOrder({ reviewReason }) }), all)
      expect(buttonOf(html, '환불하기'), reviewReason).not.toContain('aria-disabled')
    }
  })

  it('English holds it too', () => {
    const html = renderToStaticMarkup(
      <AdminOrderPanel
        {...common}
        labels={defaultPaymentLabels}
        detail={detail({ order: adminOrder({ reviewReason: 'REFUND_MISMATCH' }) })}
        {...all}
      />,
    )
    expect(html).toContain('Match with the provider first')
  })
})

/** 화면(이 부품)의 채운 단추 수 - 「주 행동은 채워진 단추 하나」 */
const filled = (html: string) => (html.match(/data-variant="primary"/g) ?? []).length

describe('AdminOrderPanel — exactly one filled button, whatever the state', () => {
  const waiting = [adminRefund({ id: 'rfd_1', status: 'REQUESTED' })]
  const all = { onSync: noop, onRefund: noop, onApprove: noop, onReject: noop }
  const states: Array<[string, AdminOrderDetail, string]> = [
    ['paid, nothing open', detail(), '환불하기'],
    [
      'a request is waiting',
      detail({
        order: adminOrder({ refundPending: true, openRefundStatus: 'REQUESTED' }),
        refunds: waiting,
      }),
      '요청대로 환불하기',
    ],
    [
      'needs a check',
      detail({ order: adminOrder({ reviewReason: 'MODE_MISMATCH' }) }),
      '결제사와 맞추기',
    ],
    [
      'needs a check (about the result, not the money) and a request is waiting',
      detail({
        order: adminOrder({
          reviewReason: 'CONFIRM_UNRESOLVED',
          refundPending: true,
          openRefundStatus: 'REQUESTED',
        }),
        refunds: waiting,
      }),
      '요청대로 환불하기',
    ],
    [
      'a refund is going out (the direct refund is blocked)',
      detail({
        order: adminOrder({ refundPending: true, openRefundStatus: 'PENDING' }),
        refunds: [adminRefund({ status: 'PENDING' })],
      }),
      '결제사와 맞추기',
    ],
    [
      'two requests waiting',
      detail({
        order: adminOrder({ refundPending: true, openRefundStatus: 'REQUESTED' }),
        refunds: [waiting[0]!, adminRefund({ id: 'rfd_2', status: 'REQUESTED' })],
      }),
      '요청대로 환불하기',
    ],
  ]

  it.each(states)('%s: one filled button, and it is the most important action', (_, d, main) => {
    const html = panel(d, all)
    expect(filled(html)).toBe(1)
    expect(buttonOf(html, main)).toContain('data-variant="primary"')
  })

  it('without the handlers a state does not need, the next most important one is the filled one; with none there is none', () => {
    // 요청이 있어도 승인 핸들러가 없으면 맞추기 → 환불하기 순
    const request = detail({
      order: adminOrder({ reviewReason: 'MODE_MISMATCH' }),
      refunds: waiting,
    })
    expect(filled(panel(request, { onSync: noop, onRefund: noop }))).toBe(1)
    expect(buttonOf(panel(request, { onSync: noop, onRefund: noop }), '결제사와 맞추기')).toContain(
      'data-variant="primary"',
    )
    expect(filled(panel(detail()))).toBe(0)
  })

  it('a blocked 환불하기 alone (no one else to press) is the filled one, dimmed', () => {
    const html = panel(
      detail({ order: adminOrder({ refundPending: true, openRefundStatus: 'PENDING' }) }),
      {
        onRefund: noop,
      },
    )
    expect(filled(html)).toBe(1)
    expect(buttonOf(html, '환불하기')).toContain('aria-disabled="true"')
  })
})

describe('AdminOrderPanel — refunding by hand', () => {
  it('a paid payment with money left has 환불하기; nothing is drawn without a handler, for an unpaid one, or with nothing left', () => {
    expect(panel(detail(), { onRefund: noop })).toContain('>환불하기<')
    expect(panel(detail())).not.toContain('>환불하기<')
    for (const order of [
      adminOrder({ status: 'FAILED', refundableAmount: 0 }),
      adminOrder({ status: 'CONFIRMING', refundableAmount: 0 }),
      adminOrder({ status: 'REFUNDED', refundedAmount: 3000, refundableAmount: 0 }),
      adminOrder({ status: 'PAID', refundableAmount: 0 }),
    ])
      expect(panel(detail({ order }), { onRefund: noop }), order.status).not.toContain('>환불하기<')
    expect(
      panel(
        detail({ order: adminOrder({ status: 'PARTIALLY_REFUNDED', refundableAmount: 1000 }) }),
        {
          onRefund: noop,
        },
      ),
    ).toContain('>환불하기<')
  })

  it('with a request waiting, the button is blocked but reachable and a sentence beside it says to decide the request (aria-describedby)', () => {
    const html = panel(
      detail({
        order: adminOrder({ refundPending: true, openRefundStatus: 'REQUESTED' }),
        refunds: [adminRefund()],
      }),
      { onRefund: noop },
    )
    const top = html.split('<section aria-label="환불"')[0] ?? ''
    const button = buttonOf(top, '환불하기')
    expect(button).toContain('aria-disabled="true"')
    expect(button).not.toMatch(/\sdisabled/)
    const id = button.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(html).toMatch(
      new RegExp(`id="${id}"[^>]*>환불 요청이 있어요. 아래에서 환불하거나 거절해 주세요`),
    )
  })

  it('with a refund already going out the sentence is 환불 중이에요 (the same words as everywhere)', () => {
    const html = panel(
      detail({
        order: adminOrder({ refundPending: true, openRefundStatus: 'PENDING' }),
        refunds: [adminRefund({ status: 'PENDING' })],
      }),
      { onRefund: noop },
    )
    const button = buttonOf(html.split('<section aria-label="환불"')[0] ?? '', '환불하기')
    const id = button.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(html).toMatch(new RegExp(`id="${id}"[^>]*>환불 중이에요`))
  })

  it('the server-less hint: when the refund list is not given the order answer alone blocks it', () => {
    const html = panel(
      detail({ order: adminOrder({ refundPending: true, openRefundStatus: 'PENDING' }) }),
      { onRefund: noop },
    )
    expect(buttonOf(html, '환불하기')).toContain('aria-disabled="true"')
  })
})

describe('AdminOrderPanel — a screen that may be old does not send money (review I-1)', () => {
  const waiting = detail({
    order: adminOrder({ refundPending: true, openRefundStatus: 'REQUESTED' }),
    refunds: [adminRefund()],
  })

  it('stale: 환불하기 is blocked but reachable, and the sentence saying why is its description', () => {
    const html = panel(detail(), { onRefund: noop, stale: true })
    const button = buttonOf(html, '환불하기')
    expect(button).toContain('aria-disabled="true"')
    expect(button).not.toMatch(/\sdisabled/)
    const id = button.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(html).toMatch(new RegExp(`id="${id}"[^>]*>최신 내용을 불러온 뒤에 환불할 수 있어요`))
  })

  it('stale: 요청대로 환불하기 is blocked the same way (it also sends money); 요청 거절하기 stays open (no money moves)', () => {
    const html = panel(waiting, { onApprove: noop, onReject: noop, stale: true })
    const approve = html.match(/<button[^>]*aria-label="요청대로 환불하기[^"]*"[^>]*>/)?.[0] ?? ''
    expect(approve).toContain('aria-disabled="true"')
    const id = approve.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(html).toMatch(new RegExp(`id="${id}"[^>]*>최신 내용을 불러온 뒤에 환불할 수 있어요`))
    expect(html.match(/<button[^>]*aria-label="요청 거절하기[^>]*>/)?.[0]).not.toContain(
      'aria-disabled',
    )
  })

  it('not stale: nothing changes', () => {
    expect(buttonOf(panel(detail(), { onRefund: noop }), '환불하기')).not.toContain('aria-disabled')
    expect(panel(detail(), { onRefund: noop })).not.toContain('최신 내용을')
  })

  it('stale and a refund request is open: the reason that is true now (decide the request) still shows - one reason, not two', () => {
    const html = panel(waiting, { onRefund: noop, onApprove: noop, stale: true })
    expect(html.match(/최신 내용을 불러온 뒤에 환불할 수 있어요/g)).toHaveLength(1)
  })

  const out = (status: 'SUCCEEDED' | 'PENDING', id = 'rfd_9') =>
    adminRefund({ id, status, amount: { amount: 2000, currency: 'KRW' } })

  it('stale: a refund that just went out is said out loud as a polite status, with the amount - the lines below are old', () => {
    const done = panel(detail(), { onRefund: noop, stale: true, refunded: out('SUCCEEDED') })
    expect(done).toMatch(/<[^>]*role="status"[^>]*>환불했어요: 2,000원</)
    const going = panel(detail(), { onRefund: noop, stale: true, refunded: out('PENDING') })
    expect(going).toMatch(/<[^>]*role="status"[^>]*>환불 중이에요: 2,000원</)
    expect(panel(detail(), { onRefund: noop, stale: true })).not.toContain('환불했어요')
  })

  it('not stale: the line is gone - the refund lines below say what is true now (the status line lasts only while the re-read failed)', () => {
    for (const status of ['SUCCEEDED', 'PENDING'] as const) {
      const html = panel(detail(), { onRefund: noop, refunded: out(status) })
      expect(html).not.toContain('환불했어요')
      expect(html).not.toContain('환불 중이에요: 2,000원')
    }
  })

  it("stale and the line is in the list: it speaks the list's status, not the old answer (a PENDING answer that the list now shows FAILED is not 「환불 중」)", () => {
    const html = panel(detail({ refunds: [adminRefund({ id: 'rfd_9', status: 'FAILED' })] }), {
      onRefund: noop,
      stale: true,
      refunded: out('PENDING'),
    })
    expect(html).not.toContain('환불 중이에요: 2,000원')
    expect(html).not.toMatch(/role="status"[^>]*>환불/)
    const settled = panel(
      detail({ refunds: [adminRefund({ id: 'rfd_9', status: 'SUCCEEDED' })] }),
      {
        onRefund: noop,
        stale: true,
        refunded: out('PENDING'),
      },
    )
    expect(settled).toMatch(/<[^>]*role="status"[^>]*>환불했어요: /)
  })

  it('stale and the list still shows the request waiting: the answer is newer than the list, so it is used', () => {
    const html = panel(detail({ refunds: [adminRefund({ id: 'rfd_9', status: 'REQUESTED' })] }), {
      onApprove: noop,
      stale: true,
      refunded: out('SUCCEEDED'),
    })
    expect(html).toMatch(/<[^>]*role="status"[^>]*>환불했어요: 2,000원</)
  })

  it('stale and the line is not in the list: the answer is all there is, so it is used', () => {
    const html = panel(detail({ refunds: [adminRefund({ id: 'rfd_1', status: 'FAILED' })] }), {
      onRefund: noop,
      stale: true,
      refunded: out('PENDING'),
    })
    expect(html).toMatch(/<[^>]*role="status"[^>]*>환불 중이에요: 2,000원</)
  })
})

describe('AdminOrderPanel — the waiting request and a stale screen (review round 3, Minor 3)', () => {
  const waitingDetail = detail({
    order: adminOrder({ refundPending: true, openRefundStatus: 'REQUESTED' }),
    refunds: [adminRefund()],
  })

  it('stale: the filled button is 결제사와 맞추기, not the blocked 요청대로 환불하기 - one filled button per screen, and it can be pressed', () => {
    const html = panel(waitingDetail, {
      onSync: noop,
      onApprove: noop,
      onReject: noop,
      stale: true,
    })
    expect(filled(html)).toBe(1)
    expect(buttonOf(html, '결제사와 맞추기')).toContain('data-variant="primary"')
    expect(buttonOf(html, '요청대로 환불하기')).toContain('aria-disabled="true"')
    expect(buttonOf(html, '요청대로 환불하기')).not.toContain('data-variant="primary"')
  })

  it('not stale: the decision is still the filled one', () => {
    const html = panel(waitingDetail, { onSync: noop, onApprove: noop, onReject: noop })
    expect(buttonOf(html, '요청대로 환불하기')).toContain('data-variant="primary"')
    expect(filled(html)).toBe(1)
  })
})

describe('AdminOrderPanel — the refund lines', () => {
  const lines = detail({
    order: adminOrder({ refundPending: true, openRefundStatus: 'REQUESTED' }),
    refunds: [
      adminRefund({ id: 'rfd_1', status: 'REQUESTED', origin: 'USER' }),
      adminRefund({
        id: 'rfd_2',
        status: 'SUCCEEDED',
        origin: 'OPERATOR',
        reasonCode: 'OPERATOR',
        amount: { amount: 500, currency: 'KRW' },
      }),
      adminRefund({
        id: 'rfd_3',
        status: 'FAILED',
        origin: 'OPERATOR',
        reasonCode: 'DUPLICATE',
        failureCode: 'EXCEED_CANCEL_AMOUNT',
        amount: { amount: 700, currency: 'KRW' },
      }),
    ],
  })

  it('each line has its status, amount, who started it (in words) and why', () => {
    const html = panel(lines, { onApprove: noop, onReject: noop })
    for (const text of [
      '환불 요청함',
      '환불됨',
      '환불 안 됨',
      '3,000원',
      '500원',
      '본인',
      '운영자',
      '운영자가 환불함',
      '같은 결제가 두 번 됐어요',
    ])
      expect(html, text).toContain(text)
    expect(html).toContain('EXCEED_CANCEL_AMOUNT') // 결제사 코드는 참조 번호 안에서만
    expect(html).toContain('이유 코드')
  })

  it('only the waiting request has the decide buttons, named after its amount: a filled 요청대로 환불하기 and a plain 요청 거절하기', () => {
    const html = panel(lines, { onApprove: noop, onReject: noop })
    expect(html).toContain('aria-label="요청대로 환불하기: 3,000원 (결제 ord_1)"')
    expect(html).toContain('aria-label="요청 거절하기: 3,000원 (결제 ord_1)"')
    expect(html.match(/요청대로 환불하기/g)).toHaveLength(2) // 보이는 글자 + 낭독 이름
    expect(buttonOf(html, '요청대로 환불하기')).toContain('data-variant="primary"')
    expect(buttonOf(html, '요청 거절하기')).toContain('data-variant="secondary"')
    expect(panel(lines)).not.toContain('요청대로 환불하기')
  })

  it('no refunds, no refunds section', () => {
    expect(panel(detail())).not.toContain('<section aria-label="환불"')
  })
})

describe('AdminOrderPanel — 결제사와 맞추기', () => {
  it('is drawn only when a handler is given; working shows a spinner named 맞추는 중', () => {
    expect(panel(detail())).not.toContain('결제사와 맞추기')
    expect(panel(detail(), { onSync: noop })).toContain('>결제사와 맞추기<')
    const busy = panel(detail(), { onSync: noop, syncing: true })
    expect(busy).toContain('맞추는 중')
    expect(busy).toContain('aria-busy="true"')
  })

  it('says it matched when it did (a polite status, not an alert)', () => {
    const html = panel(detail(), { onSync: noop, synced: clean })
    expect(html).toMatch(/role="status"[^>]*>[^<]*결제사와 맞췄어요/)
  })

  it('says why it could not, in words, with the reference', () => {
    const cases: Array<[string, number, string]> = [
      ['PAYMENT.CAPABILITY_UNSUPPORTED', 400, '이 결제사는 조회를 지원하지 않아요'],
      ['PAYMENT.UNAVAILABLE', 503, '결제사에 닿지 못했어요'],
      ['PAYMENT.PROVIDER_ERROR', 502, '결제사에 닿지 못했어요'],
      [
        'PAYMENT.MODE_MISMATCH',
        409,
        '이 결제는 지금과 다른 쪽(테스트 또는 실제 결제)의 키로 만들어져 지금 키로는 맞출 수 없어요',
      ],
      [
        'PAYMENT.PROVIDER_PAYMENT_NOT_FOUND',
        404,
        '결제사가 이 결제를 찾지 못했어요. 결제사 화면에서 확인해 주세요',
      ],
      ['COMMON.INTERNAL', 500, '맞추지 못했어요'],
    ]
    for (const [code, status, sentence] of cases) {
      const html = panel(detail(), { onSync: noop, syncError: failed(code, status) })
      expect(html, code).toContain(sentence)
      expect(html, code).toContain('trace-9')
    }
  })
})

describe('AdminOrderPanel — a matching right after an unsure send says why the lock stays', () => {
  it('names what is going on (the sent refund may still be on its way) with a polite status and no count of seconds (the number would not tick down)', () => {
    const html = panel(detail(), { onSync: noop, synced: clean, syncHeld: 40 })
    expect(html).toMatch(
      /role="status"[^>]*>[^<]*보낸 환불이 아직 가는 중일 수 있어요. 잠시 뒤 다시 맞춰 주세요/,
    )
    expect(html).not.toContain('40')
    expect(html).toContain('결제사와 맞췄어요') // 맞추기 자체는 됐다
  })

  it('says nothing when nothing is held', () => {
    expect(panel(detail(), { onSync: noop, synced: clean })).not.toContain('보낸 환불이 아직')
    expect(panel(detail(), { onSync: noop, synced: clean, syncHeld: null })).not.toContain(
      '보낸 환불이 아직',
    )
  })

  it('English says it too', () => {
    const html = renderToStaticMarkup(
      <AdminOrderPanel
        {...common}
        labels={defaultPaymentLabels}
        detail={detail()}
        onSync={noop}
        synced={clean}
        syncHeld={40}
      />,
    )
    expect(html).toContain('may still be on its way')
    expect(html).not.toContain('40')
  })
})

describe('AdminOrderPanel — a panel without 결제사와 맞추기 does not hold a button for a reason it cannot act on (R2-m1)', () => {
  const noSync = { onRefund: noop, onApprove: noop, onReject: noop }

  it('only REFUND_MISMATCH is held (the server refuses that one), with a sentence that does not send the operator to a button that is not there', () => {
    const html = panel(detail({ order: adminOrder({ reviewReason: 'REFUND_MISMATCH' }) }), noSync)
    const refund = buttonOf(html, '환불하기')
    expect(refund).toContain('aria-disabled="true"')
    const id = refund.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(html).toMatch(new RegExp(`id="${id}"[^>]*>결제사와 어긋나 있어 환불할 수 없어요`))
    expect(html).not.toContain('먼저 결제사와 맞춰 주세요')
  })

  it.each(['AMOUNT_MISMATCH', 'ORDER_MISMATCH', 'MODE_MISMATCH'])(
    '%s does not hold the refund (the server does not refuse it; only the 맞추기 button recommends going first)',
    (reviewReason) => {
      const html = panel(detail({ order: adminOrder({ reviewReason }) }), noSync)
      expect(buttonOf(html, '환불하기')).not.toContain('aria-disabled')
    },
  )

  it('with 결제사와 맞추기 all four are held as before, with the "go first" sentence', () => {
    const html = panel(detail({ order: adminOrder({ reviewReason: 'AMOUNT_MISMATCH' }) }), {
      ...noSync,
      onSync: noop,
    })
    expect(buttonOf(html, '환불하기')).toContain('aria-disabled="true"')
    expect(html).toContain('먼저 결제사와 맞춰 주세요')
  })
})

describe('AdminOrderPanel — after a matching that left the money off, the hold does not tell the operator to do what was just done (R2-m2)', () => {
  const off = detail({ order: adminOrder({ reviewReason: 'REFUND_MISMATCH' }) })
  const all = { onSync: noop, onRefund: noop, onApprove: noop, onReject: noop }

  it('says it was matched and is still off, and where to look', () => {
    const html = panel(off, { ...all, synced: { reviewReason: 'REFUND_MISMATCH' } })
    const refund = buttonOf(html, '환불하기')
    expect(refund).toContain('aria-disabled="true"')
    const id = refund.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(html).toMatch(
      new RegExp(`id="${id}"[^>]*>맞춰 봤지만 아직 어긋나 있어요. 결제사 화면에서 확인해 주세요`),
    )
    expect(html).not.toContain('먼저 결제사와 맞춰 주세요')
    expect(html).toContain('결제사와 맞췄어요')
  })

  it('a request waiting says the same on its decision button', () => {
    const html = panel(
      detail({
        order: adminOrder({
          reviewReason: 'REFUND_MISMATCH',
          refundPending: true,
          openRefundStatus: 'REQUESTED',
        }),
        refunds: [adminRefund({ id: 'rfd_1', status: 'REQUESTED' })],
      }),
      { ...all, synced: { reviewReason: 'REFUND_MISMATCH' } },
    )
    expect(html).toContain('맞춰 봤지만 아직 어긋나 있어요')
    expect(html).not.toContain('먼저 결제사와 맞춰 주세요')
  })

  it('before any matching it is still "먼저 결제사와 맞춰 주세요"', () => {
    expect(panel(off, all)).toContain('먼저 결제사와 맞춰 주세요')
  })
})

describe('AdminOrderPanel — what the matching says is about the reason on screen NOW, not "a matching once worked"', () => {
  const all = { onSync: noop, onRefund: noop, onApprove: noop, onReject: noop }
  const later = detail({ order: adminOrder({ reviewReason: 'REFUND_MISMATCH' }) })

  it('a reason that appeared after a clean matching is not told "I asked and it stays": the first words stay, and 결제사와 맞추기 is the filled button', () => {
    const html = panel(later, { ...all, synced: clean })
    expect(html).toContain('먼저 결제사와 맞춰 주세요')
    expect(html).not.toContain('맞춰 봤지만')
    expect(html).not.toContain('결제사에 다시 물었지만')
    expect(html).not.toContain('결제사와 맞췄어요') // that matching said nothing about this reason
    expect(html).toContain('누르면 결제사에 다시 물어봐요')
    expect(buttonOf(html, '결제사와 맞추기')).toContain('data-variant="primary"')
    expect(buttonOf(html, '환불하기')).toContain('data-variant="secondary"')
  })

  it('a different reason than the one the matching answered with is a new reason too', () => {
    const html = panel(later, { ...all, synced: { reviewReason: 'FULFILMENT_UNRESOLVED' } })
    expect(html).not.toContain('맞춰 봤지만')
    expect(html).toContain('먼저 결제사와 맞춰 주세요')
    expect(html).not.toContain('결제사와 맞췄어요')
  })

  it('the same reason the matching answered with is still "asked, and it stays"', () => {
    const html = panel(later, { ...all, synced: { reviewReason: 'REFUND_MISMATCH' } })
    expect(html).toContain('맞춰 봤지만 아직 어긋나 있어요')
    expect(html).toContain('결제사에 다시 물었지만 아직 남아 있어요')
    expect(html).toContain('결제사와 맞췄어요')
  })

  it('"a held send may still be on its way" belongs to the matching that just answered, not to a later reason', () => {
    expect(panel(later, { ...all, synced: clean, syncHeld: 40 })).not.toContain('보낸 환불이 아직')
    expect(
      panel(later, { ...all, synced: { reviewReason: 'REFUND_MISMATCH' }, syncHeld: 40 }),
    ).toContain('보낸 환불이 아직')
  })

  it('a matching that answered with a reason the screen no longer shows says nothing either (the screen was read again and it cleared)', () => {
    const html = panel(detail(), { ...all, synced: { reviewReason: 'REFUND_MISMATCH' } })
    expect(html).not.toContain('결제사와 맞췄어요')
  })
})

describe('AdminOrderPanel — a closed account', () => {
  it('is named 탈퇴한 계정 from accountErasedAt alone (the id stays the original one in the default mode)', () => {
    const html = panel(
      detail({
        order: adminOrder({ accountId: 'acc_1', accountErasedAt: '2026-01-01T00:00:00Z' }),
      }),
    )
    expect(html).toContain('탈퇴한 계정')
    expect(html).toContain('acc_1')
    expect(panel(detail({ order: adminOrder({ accountErasedAt: null }) }))).not.toContain(
      '탈퇴한 계정',
    )
  })
})

describe('AdminOrderPanel — the history', () => {
  const events = [
    paymentEvent({
      id: 1,
      type: 'ORDER_CREATED',
      fromStatus: null,
      toStatus: 'PENDING',
      actor: 'USER',
    }),
    paymentEvent({ id: 2, type: 'CONFIRM_SUCCEEDED', actor: 'PROVIDER' }),
    paymentEvent({
      id: 3,
      type: 'REFUND_SENT',
      refundId: 'rfd_1',
      fromStatus: 'REQUESTED',
      toStatus: 'PENDING',
      actor: 'OPERATOR',
      providerCode: 'ALREADY_CANCELED_PAYMENT',
      traceId: 'trace-42',
    }),
    paymentEvent({
      id: 4,
      type: 'SOMETHING_NEW',
      fromStatus: null,
      toStatus: null,
      actor: 'SYSTEM',
    }),
  ]

  it('lists what happened in words, who did it and the status change — newest first', () => {
    const html = panel(detail({ events }))
    expect(html).toContain('이력')
    const at = (text: string) => html.indexOf(text)
    for (const text of [
      '결제를 시작했어요',
      '결제가 확인됐어요',
      '환불을 결제사에 보냈어요',
      '본인',
      '결제사',
      '운영자',
      '시스템',
    ])
      expect(at(text), text).toBeGreaterThan(-1)
    expect(at('환불을 결제사에 보냈어요')).toBeLessThan(at('결제가 확인됐어요'))
    expect(at('결제가 확인됐어요')).toBeLessThan(at('결제를 시작했어요'))
  })

  it('a refund event reads its statuses as refund statuses (PENDING is 환불 중 there, not 결제 전)', () => {
    const html = panel(detail({ events }))
    expect(html).toContain('환불 요청함 → 환불 중')
    expect(html).toContain('결제 확인 중 → 결제됨')
  })

  it('codes go into a reference number (provider code / trace); an unknown event type is a neutral phrase, never the code', () => {
    const html = panel(detail({ events }))
    expect(html).toContain('ALREADY_CANCELED_PAYMENT')
    expect(html).toContain('trace-42')
    expect(html).toContain('기록이 있어요')
    expect(html).not.toContain('SOMETHING_NEW')
  })

  it('no events says so', () => {
    expect(panel(detail())).toContain('아직 이력이 없어요')
  })
})

describe('AdminOrderPanel — closing a stuck subscription charge', () => {
  const stuck = adminOrder({
    status: 'CONFIRMING',
    kind: 'SUBSCRIPTION_INITIAL',
    reviewReason: 'STALE_CONFIRMING',
  })
  const closeButton = (html: string) => html.includes('결제 안 됨으로 닫기')

  it('only an unanswered subscription charge gets 「결제 안 됨으로 닫기」, and only when the page can handle it', () => {
    expect(closeButton(panel(detail({ order: stuck }), { onCloseCharge: noop }))).toBe(true)
    expect(closeButton(panel(detail({ order: stuck })))).toBe(false)
    // 막 나간 승인(표시 없음)은 아직 닫을 때가 아니다
    expect(
      closeButton(
        panel(detail({ order: { ...stuck, reviewReason: null } }), { onCloseCharge: noop }),
      ),
    ).toBe(false)
    expect(
      closeButton(
        panel(detail({ order: adminOrder({ status: 'CONFIRMING', kind: 'ONE_TIME' }) }), {
          onCloseCharge: noop,
        }),
      ),
    ).toBe(false)
    expect(
      closeButton(
        panel(detail({ order: adminOrder({ status: 'PAID', kind: 'SUBSCRIPTION_INITIAL' }) }), {
          onCloseCharge: noop,
        }),
      ),
    ).toBe(false)
  })
})
