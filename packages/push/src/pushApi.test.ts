import { describe, expect, it } from 'vitest'
import { createPushApi } from './pushApi'
import { recordingClient } from './test/recordingClient'

describe('createPushApi (kotlin-skeleton notification-push, /api/v1/push)', () => {
  it('records every call with the path, method and body the server contract names', async () => {
    const { client, calls } = recordingClient()
    const api = createPushApi(client)
    await api.config()
    await api.devices()
    await api.registerDevice('inst_0123456789abcdef', {
      kind: 'WEBPUSH',
      endpoint: 'https://push.example.com/x',
      keys: { p256dh: 'p', auth: 'a' },
      label: 'Laptop',
    })
    await api.removeDevice('inst_0123456789abcdef')
    await api.sendTest('inst_0123456789abcdef')
    await api.preferences()
    await api.setPreference('comment.created', false)
    await api.getAdvertising()
    expect(calls).toEqual([
      { kind: 'value', path: '/push/config' },
      { kind: 'value', path: '/push/devices' },
      {
        kind: 'value',
        path: '/push/devices/inst_0123456789abcdef',
        request: {
          method: 'PUT',
          json: {
            kind: 'WEBPUSH',
            endpoint: 'https://push.example.com/x',
            keys: { p256dh: 'p', auth: 'a' },
            label: 'Laptop',
          },
        },
      },
      {
        kind: 'noContent',
        path: '/push/devices/inst_0123456789abcdef',
        request: { method: 'DELETE' },
      },
      {
        kind: 'noContent',
        path: '/push/devices/inst_0123456789abcdef/test',
        request: { method: 'POST' },
      },
      { kind: 'value', path: '/push/preferences' },
      {
        kind: 'value',
        path: '/push/preferences/comment.created',
        request: { method: 'PUT', json: { enabled: false } },
      },
      { kind: 'value', path: '/push/advertising' },
    ])
  })

  it('path-encodes ids and types, and the base path is configurable', async () => {
    const { client, calls } = recordingClient()
    const api = createPushApi(client, { basePath: '/me/push/' })
    await api.setPreference('a/b', true)
    await api.removeDevice('x y')
    expect(calls.map((c) => c.path)).toEqual([
      '/me/push/preferences/a%2Fb',
      '/me/push/devices/x%20y',
    ])
  })
})
