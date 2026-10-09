import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog'
import { koPaymentLabels } from './labels'
import { MySubscriptionCard } from './MySubscriptionCard'
import { SubscriptionPlanList } from './SubscriptionPlanList'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'
import type { SubscriptionEndReason, SubscriptionPlan } from './subscriptionTypes'
import { order, subscription } from './test/fixtures'

const common = { labels: koPaymentLabels, locale: 'ko-KR', formatTime: () => '2026. 11. 1.' }
const noop = () => undefined

const plans: SubscriptionPlan[] = [
  {
    code: 'basic',
    name: 'Basic',
    amount: { amount: 3900, currency: 'KRW' },
    period: 'P1M',
    level: 1,
  },
  { code: 'pro', name: 'Pro', amount: { amount: 9900, currency: 'KRW' }, period: 'P1M', level: 3 },
]

describe('SubscriptionStatusBadge', () => {
  it('says the status in words and is not pressable', () => {
    for (const [status, text] of [
      ['PENDING', '결제 확인 중'],
      ['ACTIVE', '구독 중'],
      ['PAST_DUE', '결제 다시 시도 중'],
      ['CANCELING', '해지 예약됨'],
      ['ENDED', '끝남'],
    ] as const) {
      const html = renderToStaticMarkup(
        <SubscriptionStatusBadge status={status} labels={koPaymentLabels} />,
      )
      expect(html).toContain(text)
      expect(html).not.toMatch(/<button|<a |tabindex/)
    }
  })

  it('a status it has not heard of reads 「확인 필요」, never the raw code', () => {
    const html = renderToStaticMarkup(
      <SubscriptionStatusBadge status={'PAUSED' as never} labels={koPaymentLabels} />,
    )
    expect(html).toContain('확인 필요')
    expect(html).not.toContain('PAUSED')
  })
})

describe('SubscriptionPlanList', () => {
  const list = (props: object = {}) =>
    renderToStaticMarkup(
      <SubscriptionPlanList plans={plans} onSubscribe={noop} {...common} {...props} />,
    )

  it('one card per plan: name, price per period, and one filled 「구독하기」 button each', () => {
    const html = list()
    expect(html).toContain('Basic')
    expect(html).toContain('3,900원 / 월')
    expect(html).toContain('9,900원 / 월')
    expect(html.match(/data-variant="primary"/g)).toHaveLength(2)
    expect(html).toContain('aria-label="구독하기: Basic"')
  })

  it('while one card window opens, that button spins and the others are locked', () => {
    const html = list({ busyPlanCode: 'pro' })
    expect(html.match(/aria-busy="true"/g)).toHaveLength(1)
    expect(html.match(/disabled=""/g)).toHaveLength(2) // the busy one (loading) and the other
  })

  it('no plans → an empty state, not an empty list', () => {
    const html = list({ plans: [] })
    expect(html).toContain('고를 수 있는 플랜이 없어요')
    expect(html).not.toContain('<button')
  })
})

describe('MySubscriptionCard', () => {
  const card = (over: Parameters<typeof subscription>[0] = {}, props: object = {}) =>
    renderToStaticMarkup(
      <MySubscriptionCard
        subscription={subscription(over)}
        orders={[]}
        onCancel={noop}
        {...common}
        {...props}
      />,
    )

  it('ACTIVE: plan, status in words, price per period, next payment day, card, and a filled 「해지 예약」', () => {
    const html = card()
    expect(html).toContain('Standard')
    expect(html).toContain('구독 중')
    expect(html).toContain('6,900원 / 월')
    expect(html).toContain('다음 결제일')
    expect(html).toContain('2026. 11. 1.')
    expect(html).toContain('현대카드 ····1234')
    expect(html).toMatch(/data-variant="primary"[^>]*>해지 예약</)
  })

  it('CANCELING: says when it ends instead of a next payment, and offers no second cancel', () => {
    const html = card({ status: 'CANCELING' })
    expect(html).toContain('해지 예약됨')
    expect(html).toContain('2026. 11. 1.에 끝나요')
    expect(html).not.toContain('다음 결제일')
    expect(html).not.toContain('해지 예약</button>')
  })

  it('PAST_DUE: tells it cannot be used meanwhile and still offers to end it', () => {
    const html = card({ status: 'PAST_DUE', attempt: 2 })
    expect(html).toContain('결제 다시 시도 중')
    expect(html).toContain('그동안은 이용할 수 없어요')
    expect(html).toContain('해지 예약</button>')
  })

  it('PENDING: only says the first payment is being checked (no cancel, no dates)', () => {
    const html = card({ status: 'PENDING' })
    expect(html).toContain('첫 결제를 확인하고 있어요')
    expect(html).not.toContain('해지 예약</button>')
    expect(html).not.toContain('다음 결제일')
  })

  it.each<[SubscriptionEndReason, string]>([
    ['FIRST_PAYMENT_DECLINED', '첫 결제가 되지 않아'],
    ['USER_CANCELED', '해지해서 구독이 끝났어요'],
    ['PAYMENT_FAILED', '카드를 확인하고 다시 구독해 주세요'],
    ['ACCOUNT_ERASED', '계정이 지워져'],
    ['RENEWAL_BLOCKED', '더 이어 갈 수 없는'],
    ['REFUNDED', '환불되어'],
  ])('ENDED (%s): says why in words and offers nothing to press', (endReason, text) => {
    const html = card({ status: 'ENDED', endReason, card: null })
    expect(html).toContain('끝남')
    expect(html).toContain(text)
    expect(html).not.toContain('<button')
  })

  it('ENDED with a reason it does not know says only that it ended', () => {
    const html = card({ status: 'ENDED', endReason: 'MYSTERY' as never, card: null })
    expect(html).toContain('구독이 끝났어요.')
    expect(html).not.toContain('MYSTERY')
  })

  it('recent payments: each line links through renderOrderAction (to the existing payment page)', () => {
    const html = card(
      {},
      {
        orders: [order({ id: 'ord_7', orderName: 'Standard 6,900' })],
        renderOrderAction: (o: { id: string }, label: string) => (
          <a href={`/payments/${o.id}`}>{label}</a>
        ),
      },
    )
    expect(html).toContain('최근 결제')
    expect(html).toContain('Standard 6,900')
    expect(html).toContain('href="/payments/ord_7"')
  })

  it('shows the test-payment notice on a test subscription', () => {
    expect(card({ testMode: true })).toContain('테스트 결제예요')
  })
})

describe('CancelSubscriptionDialog', () => {
  const dialog = (over: Parameters<typeof subscription>[0] = {}, props: object = {}) =>
    renderToStaticMarkup(
      <CancelSubscriptionDialog
        open
        subscription={subscription(over)}
        onClose={noop}
        onConfirm={noop}
        {...common}
        {...props}
      />,
    )

  it('ACTIVE: promises use until the end of the period and no charge after, with 「해지 예약하기」 and 「닫기」', () => {
    const html = dialog()
    expect(html).toContain('해지를 예약할까요?')
    expect(html).toContain('2026. 11. 1.까지 계속 이용할 수 있고')
    expect(html).toContain('해지 예약하기')
    expect(html).toContain('닫기')
  })

  it('PAST_DUE: warns it ends right away', () => {
    const html = dialog({ status: 'PAST_DUE' })
    expect(html).toContain('지금 해지하면 바로 끝나요')
    expect(html).not.toContain('까지 계속 이용할 수 있고')
  })

  it('a failed cancel shows the reason in the dialog with the reference number', () => {
    const error = new ApiRequestError(
      { code: 'COMMON.INTERNAL', title: 't', status: 500, timestamp: 't', traceId: 'trace-5' },
      'trace-5',
      'sp',
      'tp',
    )
    const html = dialog({}, { error })
    expect(html).toContain('해지를 예약하지 못했어요')
    expect(html).toContain('trace-5')
  })
})
