import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CancelNowDialog } from './CancelNowDialog'
import { CancelNowResultNotice } from './CancelNowResultNotice'
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog'
import { ChangePlanDialog } from './ChangePlanDialog'
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
    expect(html).toContain('3,900원 · 1개월마다 결제')
    expect(html).toContain('9,900원 · 1개월마다 결제')
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
    expect(html).toContain('6,900원 · 1개월마다 결제')
    expect(html).toContain('다음 결제일')
    expect(html).toContain('2026. 11. 1.')
    expect(html).toContain('현대카드 ····1234')
    expect(html).toMatch(/data-variant="primary"[^>]*>기간 끝에 해지</)
  })

  it('CANCELING: says when it ends instead of a next payment, and offers no second cancel', () => {
    const html = card({ status: 'CANCELING' })
    expect(html).toContain('해지 예약됨')
    expect(html).toContain('2026. 11. 1.에 끝나요')
    expect(html).not.toContain('다음 결제일')
    expect(html).not.toContain('기간 끝에 해지</button>')
  })

  it('PAST_DUE: tells it cannot be used meanwhile and still offers to end it', () => {
    const html = card({ status: 'PAST_DUE', attempt: 2 })
    expect(html).toContain('결제 다시 시도 중')
    expect(html).toContain('그동안은 이용할 수 없어요')
    expect(html).toContain('기간 끝에 해지</button>')
  })

  it('PENDING: only says the first payment is being checked (no cancel, no dates)', () => {
    const html = card({ status: 'PENDING' })
    expect(html).toContain('첫 결제를 확인하고 있어요')
    expect(html).not.toContain('기간 끝에 해지</button>')
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

describe('ChangePlanDialog', () => {
  const preview = {
    planCode: 'pro',
    planName: 'Pro',
    charge: { amount: 1500, currency: 'KRW' },
    amount: { amount: 9900, currency: 'KRW' },
    period: 'P1M',
    restartsPeriod: false,
  }
  const dialog = (props: object = {}) =>
    renderToStaticMarkup(
      <ChangePlanDialog
        open
        onClose={noop}
        onConfirm={noop}
        plans={[plans[1]!]}
        planCode="pro"
        onPlanChange={noop}
        preview={preview}
        {...common}
        {...props}
      />,
    )

  it('shows what is charged now and the price from the next payment before anything is pressed', () => {
    const html = dialog()
    expect(html).toContain('지금 결제할 금액')
    expect(html).toContain('1,500원')
    expect(html).toContain('9,900원 · 1개월마다 결제')
  })

  it('a zero charge says the change costs nothing extra, a restart says the period begins today', () => {
    expect(dialog({ preview: { ...preview, charge: { amount: 0, currency: 'KRW' } } })).toContain(
      '추가 결제 없이 바로 바뀌어요',
    )
    expect(dialog({ preview: { ...preview, restartsPeriod: true } })).toContain(
      '오늘부터 새 기간이 시작돼요',
    )
  })

  it('without an amount the confirm is locked and says it is checking', () => {
    const html = dialog({ preview: undefined, previewLoading: true })
    expect(html).toContain('결제할 금액을 확인하는 중')
    expect(html).toMatch(
      /aria-disabled="true"[^>]*>[^<]*플랜 바꾸기|플랜 바꾸기[^]*aria-disabled="true"/,
    )
  })

  it('a declined card says the plan stays as it was; a raised amount asks to look again', () => {
    const apiError = (code: string, status: number) =>
      new ApiRequestError(
        { code, title: 't', status, timestamp: '2026-01-01T00:00:00Z', traceId: 'tr' },
        'tr',
        'sp',
        'tp',
      )
    expect(dialog({ error: apiError('PAYMENT.DECLINED', 402) })).toContain('플랜은 그대로예요')
    expect(dialog({ error: apiError('PAYMENT.PLAN_CHANGE_CHARGE_CHANGED', 409) })).toContain(
      '결제할 금액이 달라졌어요',
    )
  })
})

describe('MySubscriptionCard plan change', () => {
  const card = (over: Parameters<typeof subscription>[0] = {}, props: object = {}) =>
    renderToStaticMarkup(
      <MySubscriptionCard
        subscription={subscription(over)}
        orders={[]}
        onCancel={noop}
        onChangePlan={noop}
        {...common}
        {...props}
      />,
    )

  it('an active subscription gets one filled 「플랜 올리기」 and the cancel steps back to an outline', () => {
    const html = card()
    expect(html).toMatch(/data-variant="primary"[^>]*>플랜 올리기</)
    expect(html).toMatch(/data-variant="secondary"[^>]*>기간 끝에 해지</)
  })

  it('while the change is being confirmed it says so and offers no second change', () => {
    const html = card({ pendingPlanCode: 'pro' })
    expect(html).toContain('플랜 변경 결제를 확인하고 있어요')
    expect(html).not.toContain('플랜 올리기</button>')
  })

  it('a canceling subscription is not offered a change', () => {
    expect(card({ status: 'CANCELING' })).not.toContain('플랜 올리기')
  })
})

describe('CancelNowDialog', () => {
  const preview = {
    open: true,
    refund: { amount: 3393, currency: 'KRW' },
    withdrawal: false,
    lines: [
      { code: 'PAID' as const, amount: 3900 },
      { code: 'USED' as const, amount: -130 },
      { code: 'PENALTY' as const, amount: -377 },
    ],
  }
  const dialog = (props: object = {}) =>
    renderToStaticMarkup(
      <CancelNowDialog open onClose={noop} onConfirm={noop} preview={preview} {...common} {...props} />,
    )

  it('shows the refund and every line of the calculation before anything is pressed, the deductions with a minus', () => {
    const html = dialog()
    expect(html).toContain('환불 예정 금액')
    expect(html).toContain('3,393원')
    expect(html).toContain('3,900원')
    expect(html).toContain('-130원')
    expect(html).toContain('-377원')
    expect(html).toContain('위약금')
  })

  it('inside the withdrawal period it says the whole payment comes back', () => {
    const html = dialog({
      preview: { ...preview, withdrawal: true, refund: { amount: 3900, currency: 'KRW' }, lines: [preview.lines[0]] },
    })
    expect(html).toContain('철회 기간 안이라 낸 금액을 모두 돌려드려요')
    expect(html).not.toContain('위약금')
  })

  it('without an amount the confirm is locked and says it is checking', () => {
    const html = dialog({ preview: undefined, previewLoading: true })
    expect(html).toContain('환불 금액을 확인하는 중')
    expect(html).toMatch(/aria-disabled="true"[^>]*>[^<]*지금 해지하고 환불받기|지금 해지하고 환불받기[^]*aria-disabled="true"/)
  })

  it('says why a refused cancel was refused', () => {
    const apiError = (code: string) =>
      new ApiRequestError(
        { code, title: 't', status: 409, timestamp: '2026-01-01T00:00:00Z', traceId: 'tr' },
        'tr',
        'sp',
        'tp',
      )
    expect(dialog({ error: apiError('PAYMENT.SUBSCRIPTION_CHARGE_IN_PROGRESS') })).toContain('결제를 확인하는 중이라')
    expect(dialog({ error: apiError('PAYMENT.SUBSCRIPTION_CANCEL_NOT_ALLOWED') })).toContain('기간 끝에 해지를 이용해')
  })
})

describe('CancelNowResultNotice', () => {
  const result = (status: 'SUCCEEDED' | 'PENDING' | 'FAILED' | 'NOT_SENT', refund = 3393) => ({
    subscription: subscription({ status: 'ENDED', endReason: 'USER_CANCELED_NOW' }),
    refund: { amount: refund, currency: 'KRW' },
    withdrawal: false,
    lines: [],
    refunds: [{ orderId: 'ord_1', amount: { amount: refund, currency: 'KRW' }, status }],
  })
  const notice = (r: ReturnType<typeof result>) =>
    renderToStaticMarkup(<CancelNowResultNotice result={r} {...common} />)

  it('says the refund amount when it went through, and never claims a refund that failed or is still going out', () => {
    expect(notice(result('SUCCEEDED'))).toContain('3,393원을 돌려드려요')
    expect(notice(result('SUCCEEDED', 0))).toContain('돌려드릴 금액은 없어요')
    expect(notice(result('PENDING'))).toContain('환불을 처리하고 있어요')
    expect(notice(result('NOT_SENT'))).toContain('환불을 처리하고 있어요')
    expect(notice(result('FAILED'))).toContain('환불을 마치지 못했어요')
  })
})

describe('MySubscriptionCard cancel now', () => {
  const card = (over: Parameters<typeof subscription>[0] = {}, props: object = {}) =>
    renderToStaticMarkup(
      <MySubscriptionCard subscription={subscription(over)} orders={[]} onCancel={noop} {...common} {...props} />,
    )

  it('the two cancel buttons weigh the same - both outlined - and the second only exists when the parent offers it', () => {
    const html = card({}, { onCancelNow: noop })
    expect(html).toMatch(/data-variant="secondary"[^>]*>기간 끝에 해지</)
    expect(html).toMatch(/data-variant="secondary"[^>]*>지금 해지하고 환불</)
    expect(html).not.toMatch(/data-variant="primary"/)
    expect(card()).not.toContain('지금 해지하고 환불')
  })

  it('a subscription already set to end can still be ended now, but is not offered a second period-end cancel', () => {
    const html = card({ status: 'CANCELING' }, { onCancelNow: noop })
    expect(html).toContain('지금 해지하고 환불')
    expect(html).not.toContain('기간 끝에 해지</button>')
  })

  it('an ended or past-due subscription has no cancel-now', () => {
    expect(card({ status: 'ENDED' }, { onCancelNow: noop })).not.toContain('지금 해지하고 환불')
    expect(card({ status: 'PAST_DUE' }, { onCancelNow: noop })).not.toContain('지금 해지하고 환불')
  })
})
