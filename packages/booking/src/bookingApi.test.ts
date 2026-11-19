import { describe, expect, it } from 'vitest'
import { createBookingApi } from './bookingApi'
import { recordingClient } from './test/recordingClient'

describe('createBookingApi', () => {
  it('reads the pool and the snapshot, and names the stream address', async () => {
    const { client, calls } = recordingClient({})
    const api = createBookingApi(client)
    await api.pool('bkp_1')
    await api.snapshot('bkp_1')
    expect(api.streamUrl('bkp_1')).toBe('http://api.test/api/v1/booking/pools/bkp_1/seats/stream')
    expect(calls.map((c) => [c.kind, c.path])).toEqual([
      ['value', '/booking/pools/bkp_1'],
      ['value', '/booking/pools/bkp_1/seats'],
    ])
  })

  it('takes seats with the entry token in X-Entry-Token, and sends no token header without one', async () => {
    const { client, calls } = recordingClient({})
    const api = createBookingApi(client)
    await api.addSeats('bkp_1', ['bks_1', 'bks_2'], 'entry')
    await api.addSeats('bkp_1', ['bks_3'], null)
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/booking/pools/bkp_1/hold/seats',
      request: {
        method: 'POST',
        json: { seatIds: ['bks_1', 'bks_2'] },
        headers: { 'X-Entry-Token': 'entry' },
      },
    })
    expect(calls[1].request?.headers).toEqual({})
  })

  it('lets go of one seat with DELETE and uses the hold actions as POST', async () => {
    const { client, calls } = recordingClient({})
    const api = createBookingApi(client)
    await api.removeSeat('bkp_1', 'bks_1')
    await api.checkout('bkh_1')
    await api.release('bkh_1')
    await api.confirm('bkh_1')
    await api.cancel('bkh_1')
    expect(calls.map((c) => `${c.request?.method} ${c.path}`)).toEqual([
      'DELETE /booking/pools/bkp_1/hold/seats/bks_1',
      'POST /booking/holds/bkh_1/checkout',
      'POST /booking/holds/bkh_1/release',
      'POST /booking/holds/bkh_1/confirm',
      'POST /booking/holds/bkh_1/cancel',
    ])
  })

  it('lists my holds from /holds/me', async () => {
    const { client, calls } = recordingClient([])
    await createBookingApi(client).myHolds()
    expect(calls).toEqual([{ kind: 'list', path: '/booking/holds/me' }])
  })
})
