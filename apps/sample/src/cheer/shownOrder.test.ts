import type { Order } from '@skeleton/payment'
import { describe, expect, it } from 'vitest'
import { shownOrderOf } from './shownOrder'

const order = (status: Order['status']) => ({ id: 'ord_1', status }) as Order

describe('shownOrderOf — which order the result screen reads', () => {
  it('what the server read back wins once the order has moved past 「결제 전」', () => {
    expect(shownOrderOf({ read: order('CONFIRMING'), reply: order('PAID') })?.status).toBe(
      'CONFIRMING',
    )
    expect(shownOrderOf({ read: order('PAID'), reply: order('CONFIRMING') })?.status).toBe('PAID')
  })

  it("a read that still says 「결제 전」 (taken before the confirm landed) gives way to the confirm's own answer", () => {
    expect(shownOrderOf({ read: order('PENDING'), reply: order('PAID') })?.status).toBe('PAID')
  })

  it('with only one of them, shows that one; with neither, nothing yet', () => {
    expect(shownOrderOf({ read: order('PENDING') })?.status).toBe('PENDING')
    expect(shownOrderOf({ reply: order('CANCELED') })?.status).toBe('CANCELED')
    expect(shownOrderOf({})).toBeUndefined()
  })

  it('a window that came back with a failure shows 「결제 안 됨」, and one the person closed shows 「그만둠」 — whatever the server has read so far', () => {
    for (const status of ['PENDING', 'CANCELED'] as const) {
      expect(shownOrderOf({ read: order(status), left: 'failed' })?.status, status).toBe('FAILED')
      expect(shownOrderOf({ read: order(status), left: 'canceled' })?.status, status).toBe(
        'CANCELED',
      )
    }
    // 그만둠 호출의 답이 아직 「결제 전」이어도 주소가 말한 대로
    expect(shownOrderOf({ reply: order('PENDING'), left: 'canceled' })?.status).toBe('CANCELED')
  })

  it("the server's word wins once it says the money moved (PAID · CONFIRMING · refunded) — a failure address never overrules it", () => {
    for (const status of ['PAID', 'CONFIRMING', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const)
      expect(shownOrderOf({ read: order(status), left: 'failed' })?.status, status).toBe(status)
  })

  it('with nothing read at all there is nothing to show (the screen then says it from the address alone)', () => {
    expect(shownOrderOf({ left: 'canceled' })).toBeUndefined()
  })
})
