import { describe, expect, it } from 'vitest'
import { recordingClient } from '../stories/fakeClient'
import { createPointApi } from './pointApi'

describe('createPointApi', () => {
  it('reads the balance with GET /points', async () => {
    const { client, calls } = recordingClient({ balance: 1 })
    await createPointApi(client).points()
    expect(calls).toEqual([{ kind: 'value', path: '/points', request: undefined }])
  })

  it('reads history by cursor with GET /points/history?cursor=, no param on the first page', async () => {
    const { client, calls } = recordingClient({ values: [] })
    const api = createPointApi(client)
    await api.pointHistory()
    await api.pointHistory('next-1')
    expect(calls).toEqual([
      { kind: 'cursor', path: '/points/history', request: { params: {} } },
      { kind: 'cursor', path: '/points/history', request: { params: { cursor: 'next-1' } } },
    ])
  })
})
