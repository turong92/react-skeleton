import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createBroadcastAdminApi } from './adminApi'
import type { BroadcastInput } from './types'

type Call = { kind: string; path: string; request?: ApiRequest }

function recording() {
  const calls: Call[] = []
  const record = (kind: string) => async (path: string, request?: ApiRequest) => {
    calls.push({ kind, path, request })
    return {} as never
  }
  return {
    calls,
    client: { value: record('value'), list: record('list'), noContent: record('noContent') },
  }
}

const input: BroadcastInput = {
  type: 'notice.service',
  title: 'Maintenance',
  body: null,
  link: '/status',
  channels: ['push'],
  audience: { kind: 'role', param: 'USER' },
}

describe('createBroadcastAdminApi (spec §5)', () => {
  it('records the path, method and body of every call', async () => {
    const { client, calls } = recording()
    const api = createBroadcastAdminApi(client)
    await api.options()
    await api.audienceCount({ kind: 'role', param: 'USER' })
    await api.audienceCount({ kind: 'all' })
    await api.list({ status: 'SENT', before: 'bc_9', limit: 20 })
    await api.get('bc/1')
    await api.create(input)
    await api.update('bc/1', input)
    await api.remove('bc/1')
    await api.sendTest('bc/1')
    await api.send('bc/1')
    await api.send('bc/1', '2026-12-01T00:00:00.000Z')
    await api.unschedule('bc/1')
    await api.cancel('bc/1')
    await api.resume('bc/1')
    const base = '/admin/broadcasts'
    expect(calls).toEqual([
      { kind: 'value', path: `${base}/options`, request: undefined },
      {
        kind: 'value',
        path: `${base}/audience-count`,
        request: { params: { kind: 'role', param: 'USER' } },
      },
      { kind: 'value', path: `${base}/audience-count`, request: { params: { kind: 'all' } } },
      {
        kind: 'list',
        path: base,
        request: { params: { status: 'SENT', before: 'bc_9', limit: 20 } },
      },
      { kind: 'value', path: `${base}/bc%2F1`, request: undefined },
      { kind: 'value', path: base, request: { method: 'POST', json: input } },
      { kind: 'value', path: `${base}/bc%2F1`, request: { method: 'PUT', json: input } },
      { kind: 'noContent', path: `${base}/bc%2F1`, request: { method: 'DELETE' } },
      { kind: 'noContent', path: `${base}/bc%2F1/test`, request: { method: 'POST' } },
      { kind: 'noContent', path: `${base}/bc%2F1/send`, request: { method: 'POST', json: {} } },
      {
        kind: 'noContent',
        path: `${base}/bc%2F1/send`,
        request: { method: 'POST', json: { scheduledAt: '2026-12-01T00:00:00.000Z' } },
      },
      { kind: 'noContent', path: `${base}/bc%2F1/unschedule`, request: { method: 'POST' } },
      { kind: 'noContent', path: `${base}/bc%2F1/cancel`, request: { method: 'POST' } },
      { kind: 'noContent', path: `${base}/bc%2F1/resume`, request: { method: 'POST' } },
    ])
  })

  it('takes another base path', async () => {
    const { client, calls } = recording()
    await createBroadcastAdminApi(client, { basePath: '/ops/notices/' }).options()
    expect(calls[0]?.path).toBe('/ops/notices/options')
  })
})
