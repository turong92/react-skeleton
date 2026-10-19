import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultPaymentLabels, koPaymentLabels } from '../labels'
import { adminOrder, adminRefund, paymentEvent } from '../test/fixtures'
import { AdminOrderPanel } from './AdminOrderPanel'
import { AdminOrderTable } from './AdminOrderTable'
import type { AdminOrderDetail } from './types'

const common = { labels: koPaymentLabels, locale: 'ko-KR', formatTime: () => '2026. 1. 1.' }
const noop = () => undefined
const detail = (over: Partial<AdminOrderDetail> = {}): AdminOrderDetail => ({
  order: adminOrder(),
  refunds: [],
  events: [],
  ...over,
})
const panel = (d: AdminOrderDetail, props: Partial<ComponentProps<typeof AdminOrderPanel>> = {}) =>
  renderToStaticMarkup(<AdminOrderPanel {...common} detail={d} {...props} />)
const withReason = (
  reviewReason: string,
  props: Partial<ComponentProps<typeof AdminOrderPanel>> = {},
) => panel(detail({ order: adminOrder({ reviewReason }) }), { onSync: noop, ...props })

describe('review reasons the backend gives beyond the first five (contract 4 · 6 · 7)', () => {
  it('money received but delivery never finished is its own sentence, and 맞추기 is said to retry the job (not to ask the provider)', () => {
    const html = withReason('FULFILMENT_UNRESOLVED')
    expect(html).toContain('돈은 받았는데 지급이 끝내 안 됐어요')
    expect(html).toContain('다시 걸어요')
    expect(html).not.toContain('결제사에 다시 물어봐요')
    expect(html).not.toContain('FULFILMENT_UNRESOLVED')
    expect(html).not.toContain('확인이 필요한 일이 있어요')
  })

  it('refunded but the take-back never finished is its own sentence with the same retry hint', () => {
    const html = withReason('REFUND_APPLY_UNRESOLVED')
    expect(html).toContain('환불은 됐는데 회수가 끝내 안 됐어요')
    expect(html).toContain('다시 걸어요')
    expect(html).not.toContain('결제사에 다시 물어봐요')
  })

  it('the reasons about money keep the ask-the-provider hint', () => {
    for (const reason of [
      'AMOUNT_MISMATCH',
      'CONFIRM_UNRESOLVED',
      'STALE_CONFIRMING',
      'STALE_REFUND',
    ])
      expect(withReason(reason), reason).toContain('결제사에 다시 물어봐요')
  })

  it('the two derived reasons for a line left in 결제 확인 중 / 환불 중 are said in words, in the panel and in the list', () => {
    const confirming = withReason('STALE_CONFIRMING')
    expect(confirming).toContain('결제 확인 중인 채로 오래 남아 있어요')
    expect(confirming).not.toContain('STALE_CONFIRMING')
    expect(withReason('STALE_REFUND')).toContain('환불 중인 채로 오래 남아 있어요')
    const table = renderToStaticMarkup(
      <AdminOrderTable
        {...common}
        orders={[adminOrder({ reviewReason: 'STALE_REFUND' })]}
        onOpen={noop}
      />,
    )
    expect(table).toContain('환불 중인 채로 오래 남아 있어요')
    expect(table).toContain('확인 필요')
    expect(table).not.toContain('STALE_REFUND')
  })

  it('after 맞추기 a reason that stays does not tell the operator to press it again: derived and unmatched reasons say what is true now', () => {
    for (const reason of ['STALE_CONFIRMING', 'STALE_REFUND', 'AMOUNT_MISMATCH']) {
      const html = withReason(reason, { synced: { reviewReason: reason } })
      expect(html, reason).toContain('결제사에 다시 물었지만 아직 남아 있어요')
      expect(html, reason).not.toContain('누르면 결제사에 다시 물어봐요')
    }
    for (const reason of ['FULFILMENT_UNRESOLVED', 'REFUND_APPLY_UNRESOLVED']) {
      const html = withReason(reason, { synced: { reviewReason: reason } })
      expect(html, reason).toContain('끝나지 않은 그 일을 다시 걸었어요. 끝나면 이 표시가 사라져요')
      expect(html, reason).not.toContain('누르면 끝나지 않은 그 일을 다시 걸어요')
    }
  })

  it('before 맞추기 (or when it failed) the first hint stays', () => {
    expect(withReason('STALE_CONFIRMING')).toContain('누르면 결제사에 다시 물어봐요')
    expect(withReason('FULFILMENT_UNRESOLVED')).toContain('누르면 끝나지 않은 그 일을 다시 걸어요')
    const failed = withReason('STALE_CONFIRMING', {
      synced: { reviewReason: 'STALE_CONFIRMING' },
      syncError: new Error('x'),
    })
    expect(failed).toContain('누르면 결제사에 다시 물어봐요')
    expect(failed).not.toContain('아직 남아 있어요')
  })

  it('an order with no reason left (matching cleared it) shows no notice at all, synced or not', () => {
    const html = panel(detail(), { onSync: noop, synced: { reviewReason: null } })
    expect(html).not.toContain('아직 남아 있어요')
    expect(html).not.toContain('다시 걸었어요')
  })

  it('the account of a closed account is named 탈퇴한 계정 next to the (stand-in) id; an ordinary account is not', () => {
    const closed = panel(detail({ order: adminOrder({ accountId: 'deleted:3f9a1c0b7d2e4a55' }) }))
    expect(closed).toContain('탈퇴한 계정')
    expect(closed).toContain('deleted:3f9a1c0b7d2e4a55')
    expect(panel(detail())).not.toContain('탈퇴한 계정')
  })

  it('English says the same four things', () => {
    const en = { ...common, labels: defaultPaymentLabels }
    const html = (reason: string) =>
      renderToStaticMarkup(
        <AdminOrderPanel
          {...en}
          detail={detail({ order: adminOrder({ reviewReason: reason }) })}
          onSync={noop}
        />,
      )
    expect(html('FULFILMENT_UNRESOLVED')).toContain('delivery never finished')
    expect(html('REFUND_APPLY_UNRESOLVED')).toContain('taking back')
    expect(html('STALE_CONFIRMING')).toContain('confirming the payment')
    expect(html('STALE_REFUND')).toContain('refunding')
    expect(html('FULFILMENT_UNRESOLVED')).not.toContain('FULFILMENT_UNRESOLVED')
  })

  it('REFUND_APPLIED in the history reads as words', () => {
    const html = panel(detail({ events: [paymentEvent({ type: 'REFUND_APPLIED' })] }))
    expect(html).toContain('환불에 맞춰 지급을 거둬들였어요')
    expect(html).not.toContain('REFUND_APPLIED')
    expect(html).not.toContain('기록이 있어요')
  })
})

describe('the refund line failure codes our backend gives (contract 4)', () => {
  const lineWith = (status: 'FAILED' | 'SUCCEEDED', failureCode: string) =>
    panel(detail({ refunds: [adminRefund({ status, failureCode })] }))

  it.each([
    ['NOT_APPLIED', '결제사에서 환불이 적용되지 않았어요'],
    ['PROVIDER_PENDING', '결제사의 환불 결과를 기다리고 있어요 — 끝나면 이 줄이 바뀌어요'],
    ['PROVIDER_REJECTED', '결제사가 이 환불을 거절했어요. 다시 환불할 수 있어요'],
    ['RESULT_MISMATCH', '결제사의 답이 요청과 맞지 않았어요'],
    ['ORDER_REFUNDED', '이미 환불된 결제라서 닫혔어요'],
    [
      'LATE_RESULT',
      '닫힌 뒤에 결제사의 환불 결과가 도착했어요. 다른 환불 줄과 환불된 금액을 확인해 주세요',
    ],
    ['REFUND_DECLINED', '결제사가 이 환불을 받아 주지 않았어요'],
  ])('%s is a sentence, not the raw code', (code, sentence) => {
    const html = lineWith('FAILED', code)
    expect(html).toContain(sentence)
    expect(html).not.toContain(code)
  })

  it('a closed line with LATE_RESULT is not read as "환불 안 됨 + a reason code" alone: money may have gone out', () => {
    const html = lineWith('FAILED', 'LATE_RESULT')
    expect(html).not.toContain('이유 코드')
    expect(html).toContain('환불된 금액을 확인해 주세요')
  })

  it('PROVIDER_PENDING_EXPIRED is not a line code (the backend writes it to the history only): on a line it stays the code', () => {
    const html = lineWith('FAILED', 'PROVIDER_PENDING_EXPIRED')
    expect(html).toContain('PROVIDER_PENDING_EXPIRED')
    expect(html).toContain('이유 코드')
  })

  it('a withdrawn line says who closed it from closedBy alone (the backend sends it on operator responses too): SYSTEM = the refund finished and closed the request, USER = the buyer took it back', () => {
    const line = (over: Parameters<typeof adminRefund>[0]) =>
      panel(detail({ refunds: [adminRefund({ status: 'WITHDRAWN', ...over })] }))
    expect(line({ closedBy: 'SYSTEM' })).toContain('환불이 끝나 요청이 닫혔어요')
    expect(line({ closedBy: 'SYSTEM' })).not.toContain('환불 요청 거둠')
    expect(line({ closedBy: 'USER' })).toContain('환불 요청 거둠')
    expect(line({})).toContain('환불 요청 거둠') // 없으면 본인
    expect(line({ closedBy: null })).toContain('환불 요청 거둠')
  })

  it('the failure code is not a second source for who closed it: ORDER_REFUNDED without closedBy is read as the buyer (the field is always sent, so a guess from the code has no server to serve)', () => {
    const html = panel(
      detail({ refunds: [adminRefund({ status: 'WITHDRAWN', failureCode: 'ORDER_REFUNDED' })] }),
    )
    expect(html).toContain('환불 요청 거둠')
    expect(html).not.toContain('환불이 끝나 요청이 닫혔어요') // the badge does not guess
  })

  it('a code we do not know stays the code (with its copy button), as before', () => {
    const html = lineWith('FAILED', 'NOT_CANCELABLE_PERIOD')
    expect(html).toContain('NOT_CANCELABLE_PERIOD')
    expect(html).toContain('이유 코드')
  })

  it('a succeeded line that carries RESULT_MISMATCH says it quietly: a sentence, no 이유 코드 reference', () => {
    const html = lineWith('SUCCEEDED', 'RESULT_MISMATCH')
    expect(html).toContain('결제사의 답이 요청과 맞지 않았어요')
    expect(html).not.toContain('이유 코드')
    expect(html).not.toContain('RESULT_MISMATCH')
  })
})

describe('the history carries codes only it has (providerCode): they read as sentences, not as a code beside a misleading event name', () => {
  const eventOf = (type: string, providerCode: string) =>
    panel(detail({ events: [paymentEvent({ type, providerCode, refundId: 'rfd_1' })] }))

  it('LATE_RESULT on a REFUND_UNKNOWN entry is said as what happened, instead of 「환불 결과를 아직 몰라요」', () => {
    const html = eventOf('REFUND_UNKNOWN', 'LATE_RESULT')
    expect(html).toContain('닫힌 뒤에 결제사의 환불 결과가 도착했어요')
    expect(html).not.toContain('환불 결과를 아직 몰라요')
    expect(html).not.toContain('LATE_RESULT')
  })

  it('PROVIDER_PENDING_EXPIRED on a REFUND_FAILED entry is said beside the event name, not as a code', () => {
    const html = eventOf('REFUND_FAILED', 'PROVIDER_PENDING_EXPIRED')
    expect(html).toContain('환불이 안 됐어요')
    expect(html).toContain('결제사가 정해진 시간 안에 끝내지 못해 닫혔어요')
    expect(html).not.toContain('PROVIDER_PENDING_EXPIRED')
  })

  it('a provider code the history does not know stays a reference code, as before', () => {
    const html = eventOf('REFUND_FAILED', 'NOT_CANCELABLE_PERIOD')
    expect(html).toContain('NOT_CANCELABLE_PERIOD')
  })

  it('the trace ids stay as the reference when the code became a sentence', () => {
    const html = panel(
      detail({
        events: [
          paymentEvent({
            type: 'REFUND_UNKNOWN',
            providerCode: 'LATE_RESULT',
            providerTraceId: 'ptrace-1',
            traceId: 'trace-1',
          }),
        ],
      }),
    )
    expect(html).toContain('ptrace-1 / trace-1')
  })

  it('English says the same', () => {
    const html = renderToStaticMarkup(
      <AdminOrderPanel
        {...common}
        labels={defaultPaymentLabels}
        detail={detail({
          events: [paymentEvent({ type: 'REFUND_UNKNOWN', providerCode: 'LATE_RESULT' })],
        })}
      />,
    )
    expect(html).toContain('The provider')
    expect(html).not.toContain('LATE_RESULT')
  })
})
