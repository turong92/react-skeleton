import { ApiRequestError } from '@skeleton/api-client'
import type { ComponentProps, ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from './labels'
import type { OrderStatus } from './ledgerTypes'
import { OrderList } from './OrderList'
import { OrderStatusBadge } from './OrderStatusBadge'
import { OrderSummary } from './OrderSummary'
import { PaymentResult } from './PaymentResult'
import { RefundRequestNotOpenError } from './queries'
import { RefundRequestDialog } from './RefundRequestDialog'
import { TestModeNotice } from './TestModeNotice'
import { order, refund } from './test/fixtures'

const common = { labels: koPaymentLabels, locale: 'ko-KR', formatTime: () => '2026. 1. 1.' }
const noop = () => undefined
const declined = (data: unknown) =>
  new ApiRequestError(
    {
      code: 'PAYMENT.DECLINED',
      title: 'declined',
      status: 402,
      timestamp: 't',
      traceId: 'trace-9',
      data,
    },
    'trace-9',
    'sp',
    'tp',
  )

describe('OrderStatusBadge', () => {
  it('is a plain label: no button, no link, not focusable', () => {
    const html = renderToStaticMarkup(<OrderStatusBadge status="PAID" labels={koPaymentLabels} />)
    expect(html).toContain('결제됨')
    expect(html).not.toMatch(/<button|<a |tabindex|role="button"/)
  })

  it('says 환불 중 while a refund is in progress, even though the status is still 결제됨', () => {
    for (const props of [{ openRefundStatus: 'PENDING' as const }]) {
      const html = renderToStaticMarkup(
        <OrderStatusBadge status="PAID" {...props} labels={koPaymentLabels} />,
      )
      expect(html).toContain('환불 중')
      expect(html).not.toContain('결제됨')
    }
  })

  it('says 환불 요청함 (not 환불 중) while the refund is only asked for — money has not moved yet', () => {
    for (const status of ['PAID', 'PARTIALLY_REFUNDED'] as const) {
      const html = renderToStaticMarkup(
        <OrderStatusBadge status={status} openRefundStatus="REQUESTED" labels={koPaymentLabels} />,
      )
      expect(html).toContain('환불 요청함')
      expect(html).not.toContain('환불 중')
    }
  })

  it('an order with no open refund (openRefundStatus null) keeps its own status', () => {
    const html = renderToStaticMarkup(
      <OrderStatusBadge status="PAID" openRefundStatus={null} labels={koPaymentLabels} />,
    )
    expect(html).toContain('결제됨')
  })

  it('never shows the raw code of a status this package has not heard of: a neutral 확인 필요', () => {
    const html = renderToStaticMarkup(
      <OrderStatusBadge status={'SOMETHING_NEW' as never} labels={koPaymentLabels} />,
    )
    expect(html).toContain('확인 필요')
    expect(html).not.toContain('SOMETHING_NEW')
  })

  it('a status named like an Object.prototype member is just unknown (no table lookup through the prototype)', () => {
    const html = renderToStaticMarkup(
      <OrderStatusBadge status={'constructor' as never} labels={koPaymentLabels} />,
    )
    expect(html).toContain('확인 필요')
    expect(html).not.toContain('constructor')
  })
})

describe('OrderList', () => {
  const orders = [
    order({ id: 'ord_1', orderName: '응원하기 3,000원' }),
    order({
      id: 'ord_2',
      orderName: '응원하기 1,000원',
      amount: { amount: 1000, currency: 'KRW' },
      status: 'REFUNDED',
      card: null,
      method: 'EASY_PAY',
    }),
  ]

  it('gives every row its own 자세히 button named after the row, and the row itself is not a control', () => {
    const html = renderToStaticMarkup(<OrderList {...common} orders={orders} onOpen={noop} />)
    expect(html.match(/<li/g)).toHaveLength(2)
    expect(html.match(/<button/g)).toHaveLength(2)
    expect(html).toContain('aria-label="자세히: 응원하기 3,000원"')
    expect(html).toContain('>자세히<')
    expect(html).not.toMatch(/<li[^>]*(onclick|role="button"|tabindex)/i)
  })

  it('shows the amount, the card display (or the kind of payment) and the status label per row', () => {
    const html = renderToStaticMarkup(
      <OrderList {...common} orders={orders} onOpen={noop} labels={koPaymentLabels} />,
    )
    expect(html).toContain('3,000원')
    expect(html).toContain('현대카드 ····1234')
    expect(html).toContain('간편결제')
    expect(html).toContain('결제됨')
    expect(html).toContain('환불됨')
    expect(html).toContain('2026. 1. 1.')
  })

  it('does not draw the order id (it is an internal id, not something to read)', () => {
    const html = renderToStaticMarkup(<OrderList {...common} orders={orders} onOpen={noop} />)
    expect(html).not.toContain('ord_1')
  })

  it('uses renderAction for the end-of-row control (a router link) instead of the default button — and hands it the class that makes a link look like the button', () => {
    let given = ''
    const html = renderToStaticMarkup(
      <OrderList
        {...common}
        orders={orders}
        renderAction={(o, label, name, className) => {
          given = className
          return (
            <a className={className} href={`/payments/${o.id}`} aria-label={name}>
              {label}
            </a>
          )
        }}
      />,
    )
    expect(html).toContain('href="/payments/ord_1"')
    expect(html).not.toContain('<button')
    expect(given).not.toBe('')
    expect(html).toContain(`class="${given}"`)
  })

  it('shows 환불 요청함 on a row whose refund is only asked for, 환불 중 on one in progress', () => {
    const html = renderToStaticMarkup(
      <OrderList
        {...common}
        orders={[
          order({ id: 'a', orderName: 'A', refundPending: true, openRefundStatus: 'REQUESTED' }),
          order({ id: 'b', orderName: 'B', refundPending: true, openRefundStatus: 'PENDING' }),
        ]}
        onOpen={noop}
      />,
    )
    expect(html).toContain('환불 요청함')
    expect(html).toContain('환불 중')
  })

  it('keeps the rows it already has when a later load is running or has failed (the list does not vanish)', () => {
    const loading = renderToStaticMarkup(
      <OrderList {...common} orders={orders} onOpen={noop} loading />,
    )
    expect(loading).toContain('응원하기 3,000원')
    expect(loading).toContain('role="status"')
    const failed = renderToStaticMarkup(
      <OrderList {...common} orders={orders} onOpen={noop} error onRetry={noop} />,
    )
    expect(failed).toContain('응원하기 3,000원')
    expect(failed).toContain('role="alert"')
    expect(failed).toContain(koPaymentLabels.list.retry)
    // the rows come first, the news about the failed load comes after them
    expect(failed.indexOf('응원하기 3,000원')).toBeLessThan(failed.indexOf('role="alert"'))
    // and with no rows at all the empty state does not claim "no payments" over a load or an error
    expect(renderToStaticMarkup(<OrderList {...common} orders={[]} error />)).not.toContain(
      koPaymentLabels.list.emptyTitle,
    )
  })

  it('names the spinner of a busy 더 보기 in Korean too', () => {
    const html = renderToStaticMarkup(
      <OrderList {...common} orders={orders} onOpen={noop} onLoadMore={noop} loadingMore />,
    )
    expect(html).toContain('불러오는 중')
    expect(html).not.toContain('Loading')
  })

  it('has a 더 보기 button only when there is more to load', () => {
    const none = renderToStaticMarkup(<OrderList {...common} orders={orders} onOpen={noop} />)
    const more = renderToStaticMarkup(
      <OrderList {...common} orders={orders} onOpen={noop} onLoadMore={noop} />,
    )
    expect(none).not.toContain('더 보기')
    expect(more).toContain('더 보기')
  })

  it('has an empty state, a loading state and an error with a retry button', () => {
    expect(renderToStaticMarkup(<OrderList {...common} orders={[]} />)).toContain(
      koPaymentLabels.list.emptyTitle,
    )
    expect(renderToStaticMarkup(<OrderList {...common} orders={[]} loading />)).toContain(
      'role="status"',
    )
    const err = renderToStaticMarkup(<OrderList {...common} orders={[]} error onRetry={noop} />)
    expect(err).toContain('role="alert"')
    expect(err).toContain(koPaymentLabels.list.retry)
  })
})

describe('OrderSummary', () => {
  const summary = (props: Partial<ComponentProps<typeof OrderSummary>> = {}) =>
    renderToStaticMarkup(
      <OrderSummary
        {...common}
        order={order()}
        refunds={[]}
        onRequestRefund={noop}
        refundRequestsEnabled
        {...props}
      />,
    )

  it('has one filled 환불 요청 button when the order can be refunded', () => {
    const html = summary()
    expect(html).toContain('환불 요청')
    expect(html).toContain('data-variant="primary"')
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).not.toMatch(/<button[^>]*(disabled|aria-disabled)/)
  })

  it('draws no refund button until the server settings are known (refundRequestsEnabled undefined): no button that lights up and then goes out', () => {
    const html = summary({ refundRequestsEnabled: undefined })
    expect(html).not.toContain('<button')
    expect(html).not.toContain(koPaymentLabels.summary.requestRefund)
  })

  it('a blocked button stays reachable (aria-disabled, never disabled) and its reason is the description it is read with', () => {
    const html = summary({
      order: order({ refundPending: true, openRefundStatus: 'PENDING' }),
      refunds: [refund({ status: 'PENDING' })],
    })
    const button = html.match(/<button[^>]*>/)?.[0] ?? ''
    expect(button).toContain('aria-disabled="true"')
    expect(button).not.toMatch(/\sdisabled/)
    const describedBy = button.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(describedBy).toBeTruthy()
    expect(html).toMatch(new RegExp(`id="${describedBy}"[^>]*>환불 중이에요<`))
  })

  it('a refund only asked for says so: 이미 환불을 요청했어요, and the 환불 요청 button waits', () => {
    const html = summary({
      order: order({ refundPending: true, openRefundStatus: 'REQUESTED' }),
      refunds: [refund({ status: 'REQUESTED' })],
    })
    expect(html).toContain('이미 환불을 요청했어요')
    expect(html).toMatch(/<button[^>]*aria-disabled="true"/)
  })

  it('the head pill and the refund line say the same thing about a refund that was only asked for (환불 요청함, never 환불 중)', () => {
    const html = summary({
      order: order({ refundPending: true, openRefundStatus: 'REQUESTED' }), // the open line tells too
      refunds: [refund({ status: 'REQUESTED' })],
    })
    expect(html.match(/환불 요청함/g)).toHaveLength(2)
    expect(html).not.toContain('환불 중')
  })

  it('says why when the server has turned refund requests off', () => {
    const html = summary({ refundRequestsEnabled: false })
    expect(html).toMatch(/<button[^>]*aria-disabled="true"/)
    expect(html).toContain(koPaymentLabels.refundBlocked.unavailable)
  })

  it('stale (the page could not be read again): the request button is blocked but reachable, the reason is its description - and a reason that is true now (already asked) wins', () => {
    const html = summary({ stale: true })
    const button = html.match(/<button[^>]*>/)?.[0] ?? ''
    expect(button).toContain('aria-disabled="true"')
    expect(button).not.toMatch(/\sdisabled/)
    const id = button.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(html).toMatch(new RegExp(`id="${id}"[^>]*>${koPaymentLabels.refundBlocked.stale}`))
    const asked = summary({
      stale: true,
      order: order({ openRefundStatus: 'REQUESTED', refundPending: true }),
      refunds: [refund({ status: 'REQUESTED' })],
    })
    expect(asked).toContain(koPaymentLabels.refundBlocked.requested)
    expect(asked).not.toContain(koPaymentLabels.refundBlocked.stale)
    expect(summary()).not.toContain(koPaymentLabels.refundBlocked.stale)
  })

  it('has no refund button when nothing is left to refund or no handler was given', () => {
    const fully = summary({
      order: order({ status: 'REFUNDED', refundedAmount: 3000, refundableAmount: 0 }),
      refunds: [refund({ status: 'SUCCEEDED' })],
    })
    const unwired = summary({ onRequestRefund: undefined })
    expect(fully).not.toContain('<button')
    expect(unwired).not.toContain('<button')
  })

  it('offers 요청 거두기 only beside my own open request, as an outlined (secondary) button', () => {
    const asked = refund({ status: 'REQUESTED', origin: 'USER' })
    const withIt = summary({
      order: order({ refundPending: true, openRefundStatus: 'REQUESTED' }),
      refunds: [asked],
      onWithdrawRefund: noop,
    })
    expect(withIt).toMatch(/<button[^>]*data-variant="secondary"[^>]*>요청 거두기</)
    expect(withIt).toContain('data-variant="primary"') // the 환불 요청 button is still the one filled button
    expect(withIt.match(/data-variant="primary"/g)).toHaveLength(1)
    for (const [name, lines] of [
      ['not wired', [asked]],
      ['an operator line', [refund({ status: 'REQUESTED', origin: 'OPERATOR' })]],
      ['a refund already in progress', [refund({ status: 'PENDING' })]],
      ['a finished refund', [refund({ status: 'SUCCEEDED' })]],
    ] as const) {
      const html = summary({
        refunds: lines,
        ...(name === 'not wired' ? {} : { onWithdrawRefund: noop }),
      })
      expect(html, name).not.toContain('요청 거두기')
    }
  })

  it('names the spinner of a withdrawal in progress in Korean', () => {
    const html = summary({
      order: order({ refundPending: true, openRefundStatus: 'REQUESTED' }),
      refunds: [refund({ status: 'REQUESTED' })],
      onWithdrawRefund: noop,
      withdrawing: true,
    })
    expect(html).toContain('거두는 중')
    expect(html).not.toContain('Loading')
  })

  it('a withdrawn line the system closed (the refund finished) says so, not 「환불 요청 거둠」; a missing closedBy reads as the buyer', () => {
    const line = (closedBy?: 'USER' | 'SYSTEM') =>
      summary({
        order: order(),
        refunds: [refund({ id: 'rfd_9', status: 'WITHDRAWN', ...(closedBy ? { closedBy } : {}) })],
      })
    expect(line('SYSTEM')).toContain('환불이 끝나 요청이 닫혔어요')
    expect(line('SYSTEM')).not.toContain('환불 요청 거둠')
    expect(line('USER')).toContain('환불 요청 거둠')
    expect(line()).toContain('환불 요청 거둠')
  })

  it('lists the refund lines with their status label, amount, reason and the time that matters (finished: when it finished)', () => {
    const html = summary({
      order: order({ status: 'PARTIALLY_REFUNDED', refundedAmount: 1000, refundableAmount: 2000 }),
      refunds: [
        refund({
          id: 'rfd_1',
          status: 'SUCCEEDED',
          amount: { amount: 1000, currency: 'KRW' },
          requestedAt: 'REQUESTED-AT-1',
          completedAt: 'COMPLETED-AT-1',
        }),
        refund({ id: 'rfd_2', status: 'REJECTED', reasonCode: 'DUPLICATE', completedAt: null }),
        refund({
          id: 'rfd_3',
          status: 'WITHDRAWN',
          requestedAt: 'REQUESTED-AT-3',
          completedAt: null,
        }),
      ],
      formatTime: (iso) => iso,
    })
    expect(html).toContain('일부 환불됨')
    expect(html).toContain('환불됨')
    expect(html).toContain('환불 안 됨')
    expect(html).toContain('1,000원')
    expect(html).toContain(koPaymentLabels.refundReason.DUPLICATE)
    expect(html).not.toContain('rfd_1')
    expect(html).toContain('COMPLETED-AT-1')
    expect(html).not.toContain('REQUESTED-AT-1')
    expect(html).toContain('REQUESTED-AT-3')
  })

  it('gives refunds the system made a sentence of their own, and ignores a reason it has no text for (also one named like a prototype member)', () => {
    const html = summary({
      refunds: [
        refund({ id: 'a', status: 'SUCCEEDED', reasonCode: 'OPERATOR' }),
        refund({ id: 'b', status: 'SUCCEEDED', reasonCode: 'PROVIDER_CONSOLE' }),
        refund({ id: 'c', status: 'SUCCEEDED', reasonCode: 'constructor' }),
        refund({ id: 'd', status: 'SUCCEEDED', reasonCode: 'NEW_CODE' }),
      ],
    })
    expect(html).toContain('운영자가 환불함')
    expect(html).toContain('결제사에서 환불됨')
    expect(html).not.toContain('constructor')
    expect(html).not.toContain('NEW_CODE')
    expect(html).not.toContain('function')
  })

  it('shows the order name apart from the amount, and the card display; the test notice only in test mode', () => {
    const live = summary({ order: order({ orderName: '응원하기 3,000원' }) })
    expect(live).toContain('응원하기 3,000원')
    expect(live).toContain('현대카드 ····1234')
    expect(live).not.toContain(koPaymentLabels.testMode)
    const test = summary({ order: order({ testMode: true }) })
    expect(test).toContain(koPaymentLabels.testMode)
  })
})

describe('RefundRequestDialog', () => {
  const apiError = (code: string, status = 409) =>
    new ApiRequestError({ code, title: 't', status, timestamp: 't' }, 'tr', 'sp', 'tp')
  const dialog = (props: Partial<ComponentProps<typeof RefundRequestDialog>> = {}) =>
    renderToStaticMarkup(
      <RefundRequestDialog
        {...common}
        open
        order={order()}
        onClose={noop}
        onConfirm={noop}
        {...props}
      />,
    )

  it('offers exactly the three reasons the server accepts, and 환불 요청하기 and 닫기 (never 취소, which reads as a payment cancel)', () => {
    const html = dialog()
    for (const code of ['CUSTOMER_REQUEST', 'DUPLICATE', 'NOT_DELIVERED'])
      expect(html).toContain(`value="${code}"`)
    expect(html.match(/<option/g)).toHaveLength(3)
    expect(html).toMatch(/data-cancel=""[^>]*>닫기</)
    expect(html).not.toContain('취소')
    expect(html).toContain(koPaymentLabels.refundDialog.confirm)
    expect(html).toContain('3,000원') // 돌려받을 금액을 미리 보인다
  })

  it('a 409 REFUND_IN_PROGRESS on a screen that did not know a request was waiting says 이미 환불을 요청했어요 (the order tells which); a running refund keeps 환불 중이에요', () => {
    const inProgress = apiError('PAYMENT.REFUND_IN_PROGRESS')
    expect(
      dialog({ error: inProgress, order: order({ openRefundStatus: 'REQUESTED' }) }),
    ).toContain('이미 환불을 요청했어요')
    const running = dialog({ error: inProgress, order: order({ openRefundStatus: 'PENDING' }) })
    expect(running).toContain('환불 중이에요')
    expect(running).not.toContain('이미 환불을 요청했어요')
    expect(dialog({ error: inProgress })).toContain('환불 중이에요') // 칸이 없는 서버
  })

  it('a request whose held key came back to a closed line says the request was closed and that pressing again asks anew (never the generic "could not request")', () => {
    const html = dialog({ error: new RefundRequestNotOpenError(refund({ status: 'REJECTED' })) })
    expect(html).toContain(koPaymentLabels.refundDialog.errors.closed)
    expect(html).not.toContain(koPaymentLabels.refundDialog.errors.other)
  })

  it('shows the reason for a known refund error and keeps unknown ones generic', () => {
    expect(dialog({ error: apiError('PAYMENT.REFUND_IN_PROGRESS') })).toContain('환불 중이에요')
    expect(dialog({ error: apiError('PAYMENT.REFUND_NOT_ALLOWED') })).toContain(
      koPaymentLabels.refundBlocked.unavailable,
    )
    expect(dialog({ error: apiError('COMMON.INTERNAL', 500) })).toContain(
      koPaymentLabels.refundDialog.errors.other,
    )
  })

  it('once the server says a refund is in progress or not allowed, the confirm button is blocked but reachable (aria-disabled, described by the reason)', () => {
    const confirmButton = (html: string) =>
      html.match(
        new RegExp(`<button[^>]*>[^<]*(<[^>]*>)*${koPaymentLabels.refundDialog.confirm}`),
      )?.[0] ?? ''
    for (const code of ['PAYMENT.REFUND_IN_PROGRESS', 'PAYMENT.REFUND_NOT_ALLOWED']) {
      const html = dialog({ error: apiError(code) })
      const button = confirmButton(html)
      expect(button).toContain('aria-disabled="true"')
      expect(button).not.toMatch(/\sdisabled/)
      const id = button.match(/aria-describedby="([^"]+)"/)?.[1]
      expect(id).toBeTruthy()
      expect(html).toMatch(
        new RegExp(
          `id="${id}"[^>]*>[\\s\\S]{0,400}?(환불 중이에요|${koPaymentLabels.refundBlocked.unavailable})`,
        ),
      )
    }
    for (const html of [dialog({ error: apiError('COMMON.INTERNAL', 500) }), dialog()]) {
      const button = confirmButton(html)
      expect(button).not.toContain('aria-disabled')
      expect(button).not.toMatch(/\sdisabled/)
    }
  })

  it('with nothing left to refund the confirm button is blocked but reachable and the sentence saying why is its description', () => {
    const html = dialog({ order: order({ refundableAmount: 0 }) })
    const button =
      html.match(
        new RegExp(`<button[^>]*>[^<]*(<[^>]*>)*${koPaymentLabels.refundDialog.confirm}`),
      )?.[0] ?? ''
    expect(button).toContain('aria-disabled="true"')
    expect(button).not.toMatch(/\sdisabled/)
    const id = button.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(html).toMatch(
      new RegExp(`id="${id}"[^>]*>[\\s\\S]{0,400}?${koPaymentLabels.refundDialog.nothingToRefund}`),
    )
  })

  it('a failed request is announced with a Korean heading word, not "Error"', () => {
    const html = dialog({ error: apiError('PAYMENT.REFUND_IN_PROGRESS') })
    expect(html).toContain(koPaymentLabels.errorLabel)
    expect(html).not.toContain('>Error<')
  })
})

describe('TestModeNotice', () => {
  it('says the sentence the owner wrote', () => {
    expect(renderToStaticMarkup(<TestModeNotice labels={koPaymentLabels} />)).toContain(
      '테스트 결제예요. 실제로 돈이 나가지 않아요',
    )
  })
})

describe('PaymentResult', () => {
  it('says 결제됐어요 for a paid order, with the order name as given, and a button to the history', () => {
    const html = renderToStaticMarkup(
      <PaymentResult
        {...common}
        order={order({ orderName: '응원하기 3,000원' })}
        onViewHistory={noop}
      />,
    )
    expect(html).toContain('결제됐어요')
    expect(html).toContain('응원하기 3,000원')
    expect(html).toContain('결제 내역')
    expect(html.match(/data-variant="primary"/g)).toHaveLength(1)
  })

  it('says 확인 중 while confirming, as a live status, with nothing spinning forever in the markup', () => {
    const html = renderToStaticMarkup(
      <PaymentResult {...common} order={order({ status: 'CONFIRMING', paidAt: null })} />,
    )
    expect(html).toContain('결제 확인 중이에요')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('늦어지고')
  })

  it('a confirm sent with another payment key for an order already being confirmed is answered 202 with the current order (the new key is dropped): the screen reads that order and stays 확인 중 — it is not a rejection and not a second payment', () => {
    const html = renderToStaticMarkup(
      <PaymentResult {...common} order={order({ status: 'CONFIRMING', paidAt: null })} />,
    )
    expect(html).toContain('결제 확인 중이에요')
    expect(html).not.toContain('확인하지 못했어요')
    expect(html).not.toContain('결제 안 됨')
  })

  it('treats an order we know nothing about yet (still loading) as 확인 중', () => {
    expect(renderToStaticMarkup(<PaymentResult {...common} />)).toContain('결제 확인 중이에요')
  })

  it('goes to 늦어지고 있어요 once slowAfterMs is 0 and offers the 결제 내역 button', () => {
    const html = renderToStaticMarkup(
      <PaymentResult
        {...common}
        order={order({ status: 'CONFIRMING' })}
        slowAfterMs={0}
        onViewHistory={noop}
      />,
    )
    expect(html).toContain('확인이 늦어지고 있어요')
    expect(html).toContain('결제 내역')
  })

  it.each([
    ['LIMIT_OR_BALANCE', koPaymentLabels.failure.LIMIT_OR_BALANCE],
    ['CARD_DECLINED', koPaymentLabels.failure.CARD_DECLINED],
    ['TEMPORARY', koPaymentLabels.failure.TEMPORARY],
    ['OTHER', koPaymentLabels.failure.OTHER],
    ['A_CATEGORY_FROM_THE_FUTURE', koPaymentLabels.failure.OTHER],
  ])('picks the failure sentence by category %s', (category, sentence) => {
    const html = renderToStaticMarkup(
      <PaymentResult
        {...common}
        order={order({ status: 'FAILED', paidAt: null })}
        error={declined({ category, providerCode: 'REJECT_X' })}
      />,
    )
    expect(html).toContain('결제가 안 됐어요')
    expect(html).toContain(sentence)
  })

  const networkError = () =>
    new ApiRequestError(
      {
        code: 'CLIENT.NETWORK_ERROR',
        title: 'Network error',
        status: 0,
        timestamp: 't',
      },
      'trace-1',
      'sp',
      'tp',
    )
  const serverError = (status: number, code: string) =>
    new ApiRequestError({ code, title: 'x', status, timestamp: 't' }, 'trace-2', 'sp', 'tp')

  it.each([
    ['a network error / timeout', networkError()],
    ['a plain Error', new Error('boom')],
    ['a 502 from the server', serverError(502, 'PAYMENT.PROVIDER_ERROR')],
    ['a 503 UNAVAILABLE', serverError(503, 'PAYMENT.UNAVAILABLE')],
    ['a 401 the session could not renew', serverError(401, 'AUTH.UNAUTHORIZED')],
  ])(
    'a confirm call that ended with %s (after it was sent again) means "we do not know": 확인이 늦어지고 있어요, never 결제가 안 됐어요, no retry button',
    (_name, error) => {
      for (const held of [undefined, order({ status: 'PENDING', paidAt: null })]) {
        const html = renderToStaticMarkup(
          <PaymentResult
            {...common}
            {...(held ? { order: held } : {})}
            error={error}
            slowAfterMs={60_000}
            onRetry={noop}
            onViewHistory={noop}
          />,
        )
        expect(html).not.toContain('결제가 안 됐어요')
        expect(html).not.toContain(koPaymentLabels.result.retry)
        expect(html).toContain('확인이 늦어지고 있어요')
        expect(html).toContain('결제 내역')
        expect(html).not.toContain(koPaymentLabels.result.confirming.loading) // nothing is spinning
      }
    },
  )

  it('while the server holds the order as CONFIRMING it stays 결제 확인 중 (the server is on it and we keep asking), whatever the lost call said', () => {
    const html = renderToStaticMarkup(
      <PaymentResult
        {...common}
        order={order({ status: 'CONFIRMING', paidAt: null })}
        error={networkError()}
        slowAfterMs={60_000}
        onRetry={noop}
      />,
    )
    expect(html).toContain('결제 확인 중이에요')
    expect(html).not.toContain(koPaymentLabels.result.retry)
  })

  it.each([
    ['400 AMOUNT_MISMATCH', serverError(400, 'PAYMENT.AMOUNT_MISMATCH')],
    ['409 MODE_MISMATCH', serverError(409, 'PAYMENT.MODE_MISMATCH')],
    ['409 ORDER_NOT_PAYABLE', serverError(409, 'PAYMENT.ORDER_NOT_PAYABLE')],
    ['404 ORDER_NOT_FOUND', serverError(404, 'PAYMENT.ORDER_NOT_FOUND')],
  ])(
    'a confirmed %s on an order that is still PENDING (or not read yet) is its own stage: 결제를 확인하지 못했어요 — no spinner, no retry, a way to the history, a reference number',
    (_name, error) => {
      for (const held of [undefined, order({ status: 'PENDING', paidAt: null })]) {
        for (const slowAfterMs of [60_000, 0]) {
          const html = renderToStaticMarkup(
            <PaymentResult
              {...common}
              {...(held ? { order: held } : {})}
              error={error}
              slowAfterMs={slowAfterMs}
              onRetry={noop}
              onViewHistory={noop}
            />,
          )
          expect(html).toContain('data-stage="unconfirmed"')
          expect(html).toContain(koPaymentLabels.result.unconfirmed.title)
          expect(html).not.toContain(koPaymentLabels.result.confirming.loading)
          expect(html).not.toContain('결제 확인 중이에요')
          expect(html).not.toContain('결제가 안 됐어요')
          expect(html).not.toContain(koPaymentLabels.result.retry)
          expect(html).toContain('결제 내역')
          expect(html).toContain('trace-2') // the reference number
        }
      }
    },
  )

  it('what the server says about the order beats a confirmed 4xx: PAID is 결제됐어요, FAILED is 결제가 안 됐어요 (with the retry button), EXPIRED and CANCELED are themselves, CONFIRMING is still 확인 중', () => {
    const conflict = serverError(409, 'PAYMENT.ORDER_NOT_PAYABLE')
    const read = (status: OrderStatus) =>
      renderToStaticMarkup(
        <PaymentResult
          {...common}
          order={order({ status, paidAt: null })}
          error={conflict}
          onRetry={noop}
        />,
      )
    expect(read('PAID')).toContain('결제됐어요')
    expect(read('PARTIALLY_REFUNDED')).toContain('결제됐어요')
    const failed = read('FAILED')
    expect(failed).toContain('결제가 안 됐어요')
    expect(failed).toContain(koPaymentLabels.result.retry)
    expect(read('EXPIRED')).toContain('결제 시간이 지났어요')
    expect(read('CANCELED')).toContain('결제를 그만뒀어요')
    expect(read('CONFIRMING')).toContain('결제 확인 중이에요')
    for (const status of ['PAID', 'FAILED', 'EXPIRED', 'CANCELED', 'CONFIRMING'] as const)
      expect(read(status), status).not.toContain(koPaymentLabels.result.unconfirmed.title)
  })

  it('a confirmed refusal (402 DECLINED the server answered) is 결제가 안 됐어요 with the retry button, even before the order is refetched', () => {
    for (const held of [undefined, order({ status: 'PENDING', paidAt: null })]) {
      const html = renderToStaticMarkup(
        <PaymentResult
          {...common}
          {...(held ? { order: held } : {})}
          error={declined({ category: 'CARD_DECLINED', providerCode: 'REJECT_X' })}
          onRetry={noop}
        />,
      )
      expect(html).toContain('결제가 안 됐어요')
      expect(html).toContain(koPaymentLabels.failure.CARD_DECLINED)
      expect(html).toContain(koPaymentLabels.result.retry)
    }
  })

  it('but the order the server holds is the truth: PAID stays 결제됐어요 whatever an old error says', () => {
    const html = renderToStaticMarkup(
      <PaymentResult {...common} order={order()} error={declined({ category: 'OTHER' })} />,
    )
    expect(html).toContain('결제됐어요')
    expect(html).not.toContain('결제가 안 됐어요')
  })

  it('keeps the provider code inside the ErrorReference and nowhere else', () => {
    const html = renderToStaticMarkup(
      <PaymentResult
        {...common}
        order={order({ status: 'FAILED', paidAt: null })}
        error={declined({ category: 'CARD_DECLINED', providerCode: 'REJECT_CARD_COMPANY' })}
      />,
    )
    expect(html.match(/REJECT_CARD_COMPANY/g)).toHaveLength(1)
    expect(html).toMatch(/<code[^>]*>[^<]*REJECT_CARD_COMPANY[^<]*<\/code>/)
    expect(html).toContain('trace-9')
  })

  it('says 그만뒀어요 and 시간이 지났어요 for the other ends, and offers 다시 해 보기 when it can', () => {
    const canceled = renderToStaticMarkup(
      <PaymentResult
        {...common}
        order={order({ status: 'CANCELED', paidAt: null })}
        onRetry={noop}
      />,
    )
    expect(canceled).toContain('결제를 그만뒀어요')
    expect(canceled).toContain(koPaymentLabels.result.retry)
    const expired = renderToStaticMarkup(
      <PaymentResult {...common} order={order({ status: 'EXPIRED', paidAt: null })} />,
    )
    expect(expired).toContain('결제 시간이 지났어요')
  })

  it('a refunded payment is 환불됐어요, not 결제됐어요 (a partly refunded one is still paid)', () => {
    const refunded = renderToStaticMarkup(
      <PaymentResult {...common} order={order({ status: 'REFUNDED', refundableAmount: 0 })} />,
    )
    expect(refunded).toContain('환불됐어요')
    expect(refunded).not.toContain('결제됐어요')
    const partly = renderToStaticMarkup(
      <PaymentResult {...common} order={order({ status: 'PARTIALLY_REFUNDED' })} />,
    )
    expect(partly).toContain('결제됐어요')
  })

  it('a refunded payment still has the 결제 내역 button (it is a stage of its own, not a dead end)', () => {
    const refunded = renderToStaticMarkup(
      <PaymentResult
        {...common}
        onViewHistory={noop}
        order={order({ status: 'REFUNDED', refundableAmount: 0 })}
      />,
    )
    expect(refunded).toContain(koPaymentLabels.result.viewHistory)
  })

  it('keeps the name of what was paid for apart from the amount', () => {
    const html = renderToStaticMarkup(
      <PaymentResult {...common} order={order({ orderName: '응원하기 3,000원' })} />,
    )
    expect(html).toContain('<dt>결제 내용</dt><dd>응원하기 3,000원</dd>')
    expect(html).toContain('<dt>결제 금액</dt><dd>3,000원</dd>')
  })

  it('does not nest live regions: while confirming only the spinner speaks, and the title is described by the sentence under it', () => {
    const html = renderToStaticMarkup(
      <PaymentResult {...common} order={order({ status: 'CONFIRMING', paidAt: null })} />,
    )
    expect(html.match(/role="(status|alert)"/g)).toHaveLength(1)
    const describedBy = html.match(/<h2[^>]*aria-describedby="([^"]+)"/)?.[1]
    expect(describedBy).toBeTruthy()
    expect(html).toMatch(new RegExp(`<p id="${describedBy}"`))
    const failed = renderToStaticMarkup(
      <PaymentResult {...common} order={order({ status: 'FAILED', paidAt: null })} />,
    )
    expect(failed.match(/role="(status|alert)"/g) ?? []).toHaveLength(0)
  })

  it('shows the test notice in test mode, whatever the state', () => {
    for (const status of ['PAID', 'CONFIRMING', 'FAILED'] as const) {
      const html = renderToStaticMarkup(
        <PaymentResult {...common} order={order({ status, testMode: true })} />,
      )
      expect(html).toContain(koPaymentLabels.testMode)
    }
    expect(renderToStaticMarkup(<PaymentResult {...common} testMode />)).toContain(
      koPaymentLabels.testMode,
    )
  })
})

describe('nothing English is left on a Korean screen (the label walker cannot see what a component renders on its own)', () => {
  // 화면 낭독이 읽는 글자까지 — 태그를 벗긴 글자와 aria-label 값
  const readable = (html: string) =>
    [
      ...html.replace(/<[^>]*>/g, '\n').split('\n'),
      ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1] ?? ''),
    ].join('\n')
  const ENGLISH =
    /\b(Error|Loading|Close|Copy|Copied|Reference|Info|Success|Warning|Dismiss|Confirm|Cancel)\b/

  const apiError = (code: string, status: number) =>
    new ApiRequestError(
      { code, title: 't', status, timestamp: 't', traceId: 'trace-1' },
      'trace-1',
      'sp',
      'tp',
    )
  const cases: Array<[string, ReactElement]> = [
    [
      'list with rows, busy 더 보기',
      <OrderList {...common} orders={[order()]} onOpen={noop} onLoadMore={noop} loadingMore />,
    ],
    ['list loading', <OrderList {...common} orders={[]} loading />],
    ['list error', <OrderList {...common} orders={[]} error onRetry={noop} />],
    ['list empty', <OrderList {...common} orders={[]} />],
    [
      'summary with every kind of refund line',
      <OrderSummary
        {...common}
        order={order({ refundPending: true, openRefundStatus: 'REQUESTED' })}
        refunds={[refund({ status: 'REQUESTED' }), refund({ id: 'b', status: 'SUCCEEDED' })]}
        onRequestRefund={noop}
        onWithdrawRefund={noop}
        withdrawing
        refundRequestsEnabled
      />,
    ],
    [
      'dialog open',
      <RefundRequestDialog {...common} open order={order()} onClose={noop} onConfirm={noop} />,
    ],
    [
      'dialog busy',
      <RefundRequestDialog {...common} open order={order()} onClose={noop} onConfirm={noop} busy />,
    ],
    [
      'dialog with an error and a reference',
      <RefundRequestDialog
        {...common}
        open
        order={order()}
        onClose={noop}
        onConfirm={noop}
        error={apiError('COMMON.INTERNAL', 500)}
      />,
    ],
    [
      'dialog with nothing left to refund',
      <RefundRequestDialog
        {...common}
        open
        order={order({ refundableAmount: 0 })}
        onClose={noop}
        onConfirm={noop}
      />,
    ],
    ['result confirming', <PaymentResult {...common} order={order({ status: 'CONFIRMING' })} />],
    [
      'result failed with a reference',
      <PaymentResult
        {...common}
        order={order({ status: 'FAILED' })}
        error={declined({ category: 'OTHER', providerCode: 'X' })}
      />,
    ],
    [
      'result not confirmed with a reference',
      <PaymentResult
        {...common}
        error={apiError('PAYMENT.ORDER_NOT_PAYABLE', 409)}
        onViewHistory={noop}
      />,
    ],
    ['test notice', <TestModeNotice labels={koPaymentLabels} />],
  ]

  it.each(cases)('%s', (_name, element) => {
    expect(readable(renderToStaticMarkup(element))).not.toMatch(ENGLISH)
  })
})
