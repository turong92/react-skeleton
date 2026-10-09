import { ApiRequestError } from '@skeleton/api-client'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from '../labels'
import { adminRefund, order } from '../test/fixtures'
import { AdminRefundDialog } from './AdminRefundDialog'
import { RefundNotDoneError } from './refundOutcome'

const common = { labels: koPaymentLabels, locale: 'ko-KR', open: true, onClose: () => undefined }
const noop = () => undefined
const failed = (code: string, status: number, data?: unknown) =>
  new ApiRequestError(
    { code, title: 't', status, timestamp: 't', traceId: 'trace-9', data },
    'trace-9',
    'sp',
    'tp',
  )

type Props = ComponentProps<typeof AdminRefundDialog>
const direct = (props: Partial<Extract<Props, { mode: 'direct' }>> = {}) =>
  renderToStaticMarkup(
    <AdminRefundDialog {...common} mode="direct" order={order()} onConfirm={noop} {...props} />,
  )
const decide = (
  mode: 'approve' | 'reject',
  props: Partial<Extract<Props, { mode: 'approve' | 'reject' }>> = {},
) =>
  renderToStaticMarkup(
    <AdminRefundDialog
      {...common}
      mode={mode}
      request={adminRefund({ amount: { amount: 2000, currency: 'KRW' }, reasonCode: 'DUPLICATE' })}
      onConfirm={noop}
      {...props}
    />,
  )

/** 이름이 label 인 단추의 여는 태그 */
const buttonOf = (html: string, label: string) =>
  html.match(new RegExp(`<button[^>]*>[^<]*(<[^>]*>)*${label}`))?.[0] ?? ''

describe('AdminRefundDialog — direct refund', () => {
  it('starts with the whole refundable amount typed in, and says how much can be refunded', () => {
    const html = direct({ order: order({ refundableAmount: 2500 }) })
    expect(html).toMatch(/<input[^>]*value="2500"/)
    expect(html).toContain('환불할 수 있는 금액: 2,500원')
    expect(html).toContain('환불할 금액')
  })

  it('offers the operator reason first and the three the customer can pick, nothing else', () => {
    const html = direct()
    const values = [...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1])
    expect(values).toEqual(['OPERATOR', 'CUSTOMER_REQUEST', 'DUPLICATE', 'NOT_DELIVERED'])
    expect(html).toContain('운영자가 환불함')
  })

  it('the money-out button is the one filled-danger button 환불하기 and the way out is 닫기 (never 취소)', () => {
    const html = direct()
    expect(buttonOf(html, '환불하기')).toContain('data-variant="danger"')
    expect(html).toMatch(/data-cancel=""[^>]*>닫기</)
    expect(html).not.toContain('취소')
    expect(html).toContain('되돌릴 수 없어요')
  })

  it('a good amount leaves the confirm button open', () => {
    const button = buttonOf(direct(), '환불하기')
    expect(button).not.toContain('aria-disabled')
    expect(button).not.toMatch(/\sdisabled/)
  })

  it('with nothing left to refund the confirm is blocked but reachable, described by the sentence saying why', () => {
    const html = direct({ order: order({ refundableAmount: 0 }) })
    const button = buttonOf(html, '환불하기')
    expect(button).toContain('aria-disabled="true"')
    expect(button).not.toMatch(/\sdisabled/)
    const id = button.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(html).toMatch(new RegExp(`id="${id}"[\\s\\S]{0,300}?환불할 수 있는 금액이 없어요`))
  })

  it('server answers that block the confirm until the window is opened again: in progress, not allowed, amount changed', () => {
    const cases: Array<[string, number, string]> = [
      ['PAYMENT.REFUND_IN_PROGRESS', 409, '환불 중이에요'],
      ['PAYMENT.REFUND_NOT_ALLOWED', 409, '지금은 환불할 수 없어요'],
      ['PAYMENT.REFUND_AMOUNT_EXCEEDED', 400, '환불할 수 있는 금액이 바뀌었어요'],
    ]
    for (const [code, status, sentence] of cases) {
      const html = direct({ error: failed(code, status) })
      const button = buttonOf(html, '환불하기')
      expect(button, code).toContain('aria-disabled="true"')
      const id = button.match(/aria-describedby="([^"]+)"/)?.[1]
      expect(html, code).toMatch(new RegExp(`id="${id}"[\\s\\S]{0,400}?${sentence}`))
    }
  })

  it('a direct 409 REFUND_NOT_ALLOWED also points to 결제사와 맞추기 (the payment may be off from the provider)', () => {
    const html = direct({ error: failed('PAYMENT.REFUND_NOT_ALLOWED', 409) })
    expect(html).toContain(
      '지금은 환불할 수 없어요. 먼저 「결제사와 맞추기」로 결제사와 맞는지 확인해 주세요',
    )
  })

  it('409 REFUND_IN_PROGRESS says 환불 중 only when a refund is going out; when what is open is a waiting request it says to decide that request', () => {
    const error = failed('PAYMENT.REFUND_IN_PROGRESS', 409)
    const waiting = direct({ error, order: order({ openRefundStatus: 'REQUESTED' }) })
    expect(waiting).toContain('기다리는 환불 요청이 있어요. 그 요청을 먼저 결정해 주세요')
    expect(waiting).not.toContain('환불 중이에요')
    const going = direct({ error, order: order({ openRefundStatus: 'PENDING' }) })
    expect(going).toContain('환불 중이에요')
    expect(direct({ error })).toContain('환불 중이에요') // 모르면 지금까지처럼
    expect(buttonOf(waiting, '환불하기')).toContain('aria-disabled="true"')
  })

  it('while the result is unknown the amount and the reason are locked: read-only but reachable (not disabled), with one line saying why that both are described by', () => {
    const html = direct({ error: new TypeError('x'), order: order({ refundableAmount: 2500 }) })
    const input = html.match(/<input[^>]*>/)?.[0] ?? ''
    expect(input).toContain('readOnly')
    expect(input).not.toMatch(/\sdisabled/)
    expect(input).toContain('value="2500"')
    expect(html).not.toMatch(/<select/) // 사유도 읽기 전용 - 고를 수 있는 목록이 아니다
    expect(html).toContain('운영자가 환불함') // 보낸 사유는 그대로 보인다
    const lockedId = html.match(/<p id="([^"]+)"[^>]*>결과를 확인할 때까지 금액과 사유는/)?.[1]
    expect(lockedId, 'one line says why').toBeTruthy()
    const [amountInput = '', reasonInput = ''] = [...html.matchAll(/<input[^>]*>/g)].map(
      (m) => m[0],
    )
    for (const field of [amountInput, reasonInput]) {
      expect(field).toContain('readOnly')
      expect(field).not.toMatch(/\sdisabled/)
      expect(field.match(/aria-describedby="([^"]*)"/)?.[1]?.split(' ')).toContain(lockedId)
    }
  })

  it('a settled answer or no answer keeps both fields open (only an unknown result locks them)', () => {
    for (const error of [
      undefined,
      failed('PAYMENT.REFUND_DECLINED', 402),
      failed('PAYMENT.UNAVAILABLE', 503),
      new RefundNotDoneError(adminRefund({ status: 'FAILED' })),
    ]) {
      const html = direct({ error })
      expect(html, String(error)).toMatch(/<select/)
      expect(html, String(error)).not.toContain('readOnly')
      expect(html, String(error)).not.toContain('결과를 확인할 때까지')
    }
  })

  it('a provider refusal says why by category (words, not the provider code) and keeps the button open to try again; the reference number carries the code', () => {
    const html = direct({
      error: failed('PAYMENT.REFUND_DECLINED', 402, {
        category: 'PARTIAL_NOT_ALLOWED',
        providerCode: 'NOT_CANCELABLE_AMOUNT',
      }),
    })
    expect(html).toContain('이 결제는 일부만 환불할 수 없어요')
    expect(html).toContain('NOT_CANCELABLE_AMOUNT') // 참조 번호 안에서만
    expect(html).toContain('참조 번호')
    expect(buttonOf(html, '환불하기')).not.toContain('aria-disabled')
    // 모르는 종류는 「그 밖」 문구
    const other = direct({
      error: failed('PAYMENT.REFUND_DECLINED', 402, { category: 'SOMETHING_NEW' }),
    })
    expect(other).toContain('결제사가 환불을 받아 주지 않았어요')
    // 코드를 문구로 풀어 쓰지 않는다
    expect(html.replace(/NOT_CANCELABLE_AMOUNT/g, '')).not.toContain('NOT_CANCELABLE')
  })

  it('an answer that does not say whether the money moved (5xx, timeout, network) never claims it did not - it says the result is unknown and where to look', () => {
    for (const error of [
      failed('COMMON.INTERNAL', 500),
      failed('COMMON.TIMEOUT', 504),
      new TypeError('x'),
    ]) {
      const html = direct({ error })
      expect(html).toContain('환불 결과를 확인하지 못했어요')
      expect(html).toContain('환불 내역')
      expect(html).not.toContain('환불하지 못했어요')
      expect(buttonOf(html, '환불하기')).not.toContain('aria-disabled') // 같은 키로 다시 보내도 된다
    }
    expect(direct({ error: failed('COMMON.INTERNAL', 500) })).toContain('trace-9')
  })

  it('a settled answer without its own sentence (404 payment not found) says it could not refund, plus the reference', () => {
    const html = direct({ error: failed('PAYMENT.ORDER_NOT_FOUND', 404) })
    expect(html).toContain('환불하지 못했어요. 다시 해 보세요')
    expect(html).toContain('trace-9')
    expect(buttonOf(html, '환불하기')).not.toContain('aria-disabled')
  })

  it('409 PAYMENT.MODE_MISMATCH (the payment was made on the other side, test or real) says so instead of "try again" - on a direct refund and on an approval', () => {
    const error = failed('PAYMENT.MODE_MISMATCH', 409)
    for (const html of [direct({ error }), decide('approve', { error })]) {
      expect(html).toContain('지금 키로는 환불할 수 없어요')
      expect(html).not.toContain('다시 해 보세요')
      expect(html).toContain('trace-9')
    }
  })

  it('a request the server refused as malformed (400 VALIDATION_FAILED and its two siblings) says the content was not valid, leaves the fields open and the button pressable - nothing went out', () => {
    for (const code of [
      'COMMON.VALIDATION_FAILED',
      'COMMON.PARAMETER_VALIDATION_FAILED',
      'COMMON.MALFORMED_REQUEST',
    ]) {
      const html = direct({ error: failed(code, 400) })
      expect(html, code).toContain(
        '보낸 내용이 올바르지 않아요. 금액과 사유를 확인하고 다시 해 보세요',
      )
      expect(html, code).not.toContain('확인하지 못했어요')
      expect(html, code).not.toContain('결과를 확인할 때까지')
      expect(html, code).not.toMatch(/readonly/i)
      expect(buttonOf(html, '환불하기'), code).not.toContain('aria-disabled')
    }
  })

  it('503 PAYMENT.UNAVAILABLE is told apart from an unknown result: nothing was sent, try again in a moment', () => {
    const html = direct({ error: failed('PAYMENT.UNAVAILABLE', 503) })
    expect(html).toContain('지금은 환불을 보낼 수 없어요. 조금 뒤에 다시 해 보세요')
    expect(html).not.toContain('확인하지 못했어요')
    expect(buttonOf(html, '환불하기')).not.toContain('aria-disabled')
  })

  it('a refund line that came back closed without refunding is not shown as done: it says so neutrally (a late result can mean the money went out) and does not promise a new send', () => {
    const html = direct({ error: new RefundNotDoneError(adminRefund({ status: 'FAILED' })) })
    expect(html).toContain('이 환불 줄은 환불 없이 닫혔어요. 환불 내역을 확인해 주세요')
    expect(html).not.toContain('다시 누르면')
    expect(html).not.toContain('이 환불은 안 됐어요')
    expect(buttonOf(html, '환불하기')).not.toContain('aria-disabled')
  })

  it('while sending, both buttons are really disabled (the only time disabled is right) and the spinner reads in Korean', () => {
    const html = direct({ busy: true })
    expect(html).toMatch(/data-cancel=""[^>]*disabled/)
    expect(html).toContain('환불하는 중')
    expect(html).not.toContain('Loading')
  })
})

describe('AdminRefundDialog — approve a request', () => {
  it('shows the requested amount and reason as they are (nothing to type) and a danger 환불하기', () => {
    const html = decide('approve')
    expect(html).toContain('요청대로 환불할까요?')
    expect(html).toContain('요청한 금액')
    expect(html).toContain('2,000원')
    expect(html).toContain('같은 결제가 두 번 됐어요')
    expect(html).not.toMatch(/<input/)
    expect(html).not.toMatch(/<select/)
    expect(buttonOf(html, '환불하기')).toContain('data-variant="danger"')
  })

  it('a request bigger than what is left is blocked on the screen as well (the server has the last word)', () => {
    const html = decide('approve', { order: { refundableAmount: 1500 } })
    const button = buttonOf(html, '환불하기')
    expect(button).toContain('aria-disabled="true"')
    const id = button.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(html).toMatch(
      new RegExp(`id="${id}"[\\s\\S]{0,300}?환불할 수 있는 금액\\(1,500원\\)을 넘을 수 없어요`),
    )
  })

  it('a request that fits is not blocked, even when the order is not known', () => {
    expect(
      buttonOf(decide('approve', { order: { refundableAmount: 2000 } }), '환불하기'),
    ).not.toContain('aria-disabled')
    expect(buttonOf(decide('approve'), '환불하기')).not.toContain('aria-disabled')
  })

  it('names the payment the request is about (the person deciding sees which one, not only an amount)', () => {
    const html = decide('approve', {
      request: adminRefund({ orderId: 'ord_77', amount: { amount: 2000, currency: 'KRW' } }),
    })
    expect(html).toMatch(/결제 번호<\/dt><dd[^>]*>ord_77</)
  })

  it('a provider refusal closes the request (the ledger line becomes FAILED): the confirm is blocked but reachable, the sentence says what to do, and the reference carries the code', () => {
    const html = decide('approve', {
      error: failed('PAYMENT.REFUND_DECLINED', 402, {
        category: 'PERIOD_EXPIRED',
        providerCode: 'NOT_CANCELABLE_PERIOD',
      }),
    })
    const button = buttonOf(html, '환불하기')
    expect(button).toContain('aria-disabled="true"')
    expect(button).not.toMatch(/\sdisabled/)
    const id = button.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(html).toMatch(
      new RegExp(
        `id="${id}"[\\s\\S]{0,400}?요청은 환불 안 됨으로 닫혔어요. 결제 한 건에서 직접 환불해 주세요`,
      ),
    )
    expect(html).toContain('NOT_CANCELABLE_PERIOD')
    expect(html).not.toContain('다시 해 보세요') // 같은 요청을 다시 보내라고 하지 않는다
  })

  it('from the list the closed request offers the way to the payment (a link the page gives)', () => {
    const link = (className: string) => (
      <a className={className} href="/admin/payments/ord_1">
        결제 보기
      </a>
    )
    const closed = decide('approve', {
      error: failed('PAYMENT.REFUND_DECLINED', 402),
      orderLink: link,
    })
    expect(closed).toContain('href="/admin/payments/ord_1"')
    expect(closed).toMatch(/<a class="[^"]*actionLink[^"]*" href="\/admin\/payments\/ord_1"/) // 창이 버튼 모양 클래스를 건넨다
    expect(decide('approve', { orderLink: link })).not.toContain('href="/admin/payments/ord_1"') // 오류가 없으면 길도 없다
  })

  it('409 REFUND_NOT_ALLOWED on an approval has two meanings (already decided, or the payment cannot be refunded / the provider has none): it says neither, blocks, and leads to the payment (contract 4)', () => {
    const link = (className: string) => (
      <a className={className} href="/admin/payments/ord_1">
        결제 보기
      </a>
    )
    const html = decide('approve', {
      error: failed('PAYMENT.REFUND_NOT_ALLOWED', 409),
      orderLink: link,
    })
    expect(html).toContain(
      '지금은 이 요청대로 환불할 수 없어요. 결제 한 건에서 상태를 확인해 주세요',
    )
    expect(html).not.toContain('이미 처리된 요청이에요')
    expect(html).toContain('href="/admin/payments/ord_1"')
    expect(buttonOf(html, '환불하기')).toContain('aria-disabled="true"')
  })

  it('400 REFUND_AMOUNT_EXCEEDED on an approval leaves the request waiting: it says decline it or refund by hand from the payment (not "close and open again"), blocks, and leads to the payment (contract 5)', () => {
    const link = (className: string) => (
      <a className={className} href="/admin/payments/ord_1">
        결제 보기
      </a>
    )
    const html = decide('approve', {
      error: failed('PAYMENT.REFUND_AMOUNT_EXCEEDED', 400),
      orderLink: link,
    })
    expect(html).toContain(
      '요청 금액이 지금 환불할 수 있는 금액보다 커요. 요청을 거절하거나 결제 한 건에서 직접 환불해 주세요',
    )
    expect(html).not.toContain('창을 닫고 다시 열어')
    expect(html).toContain('href="/admin/payments/ord_1"')
    expect(buttonOf(html, '환불하기')).toContain('aria-disabled="true"')
  })

  it('an approval whose answer was lost says the result is unknown and keeps the way to look', () => {
    const link = (className: string) => (
      <a className={className} href="/admin/payments/ord_1">
        결제 보기
      </a>
    )
    const html = decide('approve', { error: new TypeError('x'), orderLink: link })
    expect(html).toContain('환불 결과를 확인하지 못했어요')
    expect(html).toContain('href="/admin/payments/ord_1"')
    expect(buttonOf(html, '환불하기')).not.toContain('aria-disabled')
  })

  it('an approval answered 2xx with a FAILED line (a late result) does not say "decline-closed, refund by hand" - it says to look at the refund history; it is blocked and leads to the payment (R2-m5)', () => {
    const link = (className: string) => (
      <a className={className} href="/admin/payments/ord_1">
        결제 보기
      </a>
    )
    const html = decide('approve', {
      error: new RefundNotDoneError(adminRefund({ status: 'FAILED' })),
      orderLink: link,
    })
    expect(html).toContain('이 환불 줄은 환불 없이 닫혔어요. 환불 내역을 확인해 주세요')
    expect(html).not.toContain('요청은 환불 안 됨으로 닫혔어요')
    expect(html).not.toContain('이미 처리된 요청이에요')
    expect(html).toContain('href="/admin/payments/ord_1"')
    expect(buttonOf(html, '환불하기')).toContain('aria-disabled="true"')
  })

  it('an approval answered with a closed line otherwise reads as already handled for a rejected or withdrawn one', () => {
    for (const status of ['REJECTED', 'WITHDRAWN'] as const)
      expect(
        decide('approve', { error: new RefundNotDoneError(adminRefund({ status })) }),
      ).toContain('이미 처리된 요청이에요')
  })

  it('503 on an approval: nothing was sent, try later - the confirm stays open', () => {
    const html = decide('approve', { error: failed('PAYMENT.UNAVAILABLE', 503) })
    expect(html).toContain('지금은 환불을 보낼 수 없어요')
    expect(buttonOf(html, '환불하기')).not.toContain('aria-disabled')
  })
})

describe('AdminRefundDialog — decline a request', () => {
  it('is a plain (not danger) 거절하기 that says no money goes out; no amount input', () => {
    const html = decide('reject')
    expect(html).toContain('환불 요청을 거절할까요?')
    expect(html).toContain('거절하면 돈은 나가지 않아요')
    expect(buttonOf(html, '거절하기')).toContain('data-variant="primary"')
    expect(html).not.toMatch(/<input/)
  })

  it('names the payment the request is about', () => {
    expect(decide('reject', { request: adminRefund({ orderId: 'ord_77' }) })).toMatch(
      /결제 번호<\/dt><dd[^>]*>ord_77</,
    )
  })

  it('409 means someone already decided it or the person took it back: says so, and the confirm is blocked', () => {
    const html = decide('reject', { error: failed('PAYMENT.REFUND_NOT_ALLOWED', 409) })
    expect(html).toContain('이미 처리된 요청이에요')
    expect(html).not.toContain('다시 해 보세요')
    expect(buttonOf(html, '거절하기')).toContain('aria-disabled="true"')
  })

  it('a lost answer does not claim it could not decline - the result is unknown', () => {
    const html = decide('reject', { error: new TypeError('x') })
    expect(html).toContain('거절 결과를 확인하지 못했어요')
    expect(html).not.toContain('거절하지 못했어요')
    expect(buttonOf(html, '거절하기')).not.toContain('aria-disabled')
  })

  it('an error says it could not decline (not that it could not refund) and carries the reference', () => {
    const html = decide('reject', { error: failed('PAYMENT.REFUND_NOT_FOUND', 404) })
    expect(html).toContain('거절하지 못했어요')
    expect(html).not.toContain('환불하지 못했어요')
    expect(html).toContain('trace-9')
  })

  it('busy reads 거절하는 중', () => {
    expect(decide('reject', { busy: true })).toContain('거절하는 중')
  })
})
