import { describe, expect, it } from 'vitest'
import { recordingClient } from '../test/recordingClient'
import { createWaitingRoomAdminApi } from './adminApi'

describe('createWaitingRoomAdminApi', () => {
  it('reads the numbers with GET /admin/waiting-rooms/{id}/stats', async () => {
    const { client, calls } = recordingClient({ prequeue: 3 })
    expect(await createWaitingRoomAdminApi(client).stats('wr_1')).toEqual({ prequeue: 3 })
    expect(calls).toEqual([{ kind: 'value', path: '/admin/waiting-rooms/wr_1/stats' }])
  })

  it('sets the rate with POST …/rate (0 pauses) and closes with POST …/close', async () => {
    const { client, calls } = recordingClient()
    const api = createWaitingRoomAdminApi(client)
    await api.setRate('wr_1', 0)
    await api.setRate('wr_1', 30)
    await api.close('wr_1')
    expect(calls).toEqual([
      {
        kind: 'noContent',
        path: '/admin/waiting-rooms/wr_1/rate',
        request: { method: 'POST', json: { perMinute: 0 } },
      },
      {
        kind: 'noContent',
        path: '/admin/waiting-rooms/wr_1/rate',
        request: { method: 'POST', json: { perMinute: 30 } },
      },
      { kind: 'noContent', path: '/admin/waiting-rooms/wr_1/close', request: { method: 'POST' } },
    ])
  })
})
