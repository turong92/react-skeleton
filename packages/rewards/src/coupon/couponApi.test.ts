import { describe, expect, it } from 'vitest'
import { recordingClient } from '../stories/fakeClient'
import { createCouponApi } from './couponApi'

describe('createCouponApi', () => {
  it('lists coupons by tab with GET /coupons?status=', async () => {
    const { client, calls } = recordingClient([])
    await createCouponApi(client).listCoupons('PAST')
    expect(calls).toEqual([
      { kind: 'list', path: '/coupons', request: { params: { status: 'PAST' } } },
    ])
  })

  it('redeems a code with POST /coupons/redeem {code}', async () => {
    const { client, calls } = recordingClient({ id: 'c1' })
    await createCouponApi(client).redeemCoupon('SPRING')
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/coupons/redeem',
        request: { method: 'POST', json: { code: 'SPRING' } },
      },
    ])
  })
})
