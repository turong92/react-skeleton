import { describe, expect, it } from 'vitest'
import { cheerAsOrder } from './cheerAsOrder'
import type { Cheer } from './types'

const cheer: Cheer = {
  orderId: 'ord_1',
  amount: { amount: 3000, currency: 'KRW' },
  refundedAmount: 0,
  status: 'PAID',
  createdAt: '2026-10-09T01:00:00Z',
  refundedAt: null,
}

describe('cheerAsOrder — a cheer drawn by the payment list part', () => {
  it('a paid cheer is 「결제됨」 and carries the id the detail screen opens', () => {
    expect(cheerAsOrder(cheer, '응원하기')).toMatchObject({
      id: 'ord_1',
      status: 'PAID',
      orderName: '응원하기',
      amount: { amount: 3000, currency: 'KRW' },
      refundedAmount: 0,
      refundableAmount: 3000,
      refundPending: false,
      openRefundStatus: null,
      paidAt: '2026-10-09T01:00:00Z',
      card: null,
      method: null,
    })
  })

  it('an easy pay the provider took directly carries its brand, so the list can name the app', () => {
    expect(cheerAsOrder({ ...cheer, easyPayBrand: 'KAKAOPAY' }, '응원하기')).toMatchObject({
      method: 'EASY_PAY',
      card: null,
      easyPayBrand: 'KAKAOPAY',
    })
  })

  it('a partly refunded cheer stays PAID on the server but reads 「일부 환불됨」 — the amount refunded is what tells', () => {
    const order = cheerAsOrder({ ...cheer, refundedAmount: 1000 }, '응원하기')
    expect(order.status).toBe('PARTIALLY_REFUNDED')
    expect(order.refundableAmount).toBe(2000)
  })

  it('a fully refunded cheer is 「환불됨」 with nothing left to refund', () => {
    const order = cheerAsOrder(
      { ...cheer, status: 'REFUNDED', refundedAmount: 3000, refundedAt: '2026-10-09T02:00:00Z' },
      '응원하기',
    )
    expect(order.status).toBe('REFUNDED')
    expect(order.refundableAmount).toBe(0)
  })

  it('shows the card only when the server sent one', () => {
    const withCard = cheerAsOrder(
      { ...cheer, card: { issuer: 'HYUNDAI', last4: '1234' } },
      '응원하기',
    )
    expect(withCard.card).toEqual({ issuer: 'HYUNDAI', last4: '1234' })
    expect(withCard.method).toBe('CARD')
  })
})
