import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koRewardsLabels } from '../labels'
import type { Coupon } from '../types'
import { CouponCard } from './CouponCard'

const coupon: Coupon = {
  id: 'c1',
  name: '겨울 쿠폰',
  status: 'AVAILABLE',
  expiresAt: null,
  usableFrom: '2026-12-24T12:00:00Z',
  stages: [],
  scope: { purposes: [], itemTypes: [], planCodes: [] },
  currency: null,
  minAmount: null,
}
const html = (now: () => number) =>
  renderToStaticMarkup(
    <CouponCard
      coupon={coupon}
      labels={koRewardsLabels}
      locale="ko-KR"
      formatDay={() => '12월 24일'}
      now={now}
    />,
  )

describe('CouponCard usable-from', () => {
  it('says when it can be used, by the clock it is given (the app gives the server clock, not the device clock)', () => {
    const before = html(() => Date.parse('2026-12-01T00:00:00Z'))
    expect(before).toContain('12월 24일부터 쓸 수 있어요')
    expect(before).toContain('data-not-yet="true"')
    const after = html(() => Date.parse('2026-12-25T00:00:00Z'))
    expect(after).not.toContain('부터 쓸 수 있어요')
    expect(after).not.toContain('data-not-yet')
  })
})
