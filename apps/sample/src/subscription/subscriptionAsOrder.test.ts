import type { Subscription } from '@skeleton/payment'
import { describe, expect, it } from 'vitest'
import { shownSubscriptionOf, subscriptionAsOrder } from './subscriptionAsOrder'

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 'sub_1',
  status: 'ACTIVE',
  planCode: 'standard',
  planName: 'Standard',
  amount: { amount: 6900, currency: 'KRW' },
  period: 'P1M',
  currentPeriodStart: '2026-10-01T03:00:00Z',
  currentPeriodEnd: '2026-11-01T03:00:00Z',
  attempt: 1,
  endReason: null,
  card: { issuer: 'HYUNDAI', last4: '1234' },
  pendingPlanCode: null,
  testMode: true,
  createdAt: '2026-10-01T03:00:00Z',
  country: 'KR',
  ...over,
})

describe('subscriptionAsOrder — the first payment read as the payment result screen reads a payment', () => {
  it('ACTIVE reads as paid, with the name, price, card and test flag', () => {
    expect(subscriptionAsOrder(sub(), 'Standard')).toMatchObject({
      id: 'sub_1',
      status: 'PAID',
      orderName: 'Standard',
      amount: { amount: 6900, currency: 'KRW' },
      card: { issuer: 'HYUNDAI', last4: '1234' },
      testMode: true,
      paidAt: '2026-10-01T03:00:00Z',
    })
  })

  it('a subscription paid through KakaoPay or NaverPay reads as an easy pay with the app name - the result screen shows 「카카오페이」, not 「카드」', () => {
    expect(subscriptionAsOrder(sub({ easyPayBrand: 'KAKAOPAY', card: null }), 'S')).toMatchObject({
      method: 'EASY_PAY',
      easyPayBrand: 'KAKAOPAY',
    })
    expect(subscriptionAsOrder(sub(), 'S')).toMatchObject({ method: 'CARD' })
  })

  it('PENDING (the provider has not answered about the first payment) reads as checking', () => {
    expect(subscriptionAsOrder(sub({ status: 'PENDING' }), 'Standard').status).toBe('CONFIRMING')
  })

  it('ENDED reads as not paid; a subscription already set to end after paying still reads as paid', () => {
    expect(subscriptionAsOrder(sub({ status: 'ENDED', card: null }), 'Standard').status).toBe(
      'FAILED',
    )
    expect(subscriptionAsOrder(sub({ status: 'CANCELING' }), 'Standard').status).toBe('PAID')
  })
})

describe('shownSubscriptionOf — which subscription the result screen reads', () => {
  it('the server read wins once it is past PENDING; a PENDING read gives way to the answer of activate', () => {
    expect(
      shownSubscriptionOf('sub_1', { read: sub({ status: 'PENDING' }), reply: sub() })?.status,
    ).toBe('ACTIVE')
    expect(
      shownSubscriptionOf('sub_1', {
        read: sub({ status: 'ACTIVE' }),
        reply: sub({ status: 'PENDING' }),
      })?.status,
    ).toBe('ACTIVE')
  })

  it('never shows another subscription (an older ended one the server still lists)', () => {
    expect(shownSubscriptionOf('sub_2', { read: sub({ id: 'sub_1' }) })).toBeUndefined()
    expect(
      shownSubscriptionOf('sub_2', { read: sub({ id: 'sub_1' }), reply: sub({ id: 'sub_2' }) })?.id,
    ).toBe('sub_2')
  })

  it('with neither, nothing yet', () => {
    expect(shownSubscriptionOf('sub_1', {})).toBeUndefined()
  })
})
