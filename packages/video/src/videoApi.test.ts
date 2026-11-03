import { describe, expect, it } from 'vitest'
import { recordingClient } from './test/recordingClient'
import { createVideoApi } from './videoApi'

describe('createVideoApi', () => {
  it('starts an upload with POST /videos', async () => {
    const { client, calls } = recordingClient({
      '/videos': { id: 'v1', uploadId: 'u1', partSize: 8 },
    })
    const started = await createVideoApi(client).start({
      bytes: 10,
      contentType: 'video/mp4',
      purpose: 'clip',
      visibility: 'PRIVATE',
    })
    expect(started).toEqual({ id: 'v1', uploadId: 'u1', partSize: 8 })
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/videos',
        request: {
          method: 'POST',
          json: { bytes: 10, contentType: 'video/mp4', purpose: 'clip', visibility: 'PRIVATE' },
        },
      },
    ])
  })

  it('asks for part URLs with POST /videos/{id}/parts and lists uploaded parts with GET', async () => {
    const parts = [{ n: 1, etag: '"a"', bytes: 8 }]
    const { client, calls } = recordingClient({
      '/videos/v%2F1/parts': parts,
    })
    const api = createVideoApi(client)
    await api.presignParts('v/1', [2, 3])
    expect(await api.listParts('v/1')).toEqual(parts)
    expect(calls).toEqual([
      {
        kind: 'list',
        path: '/videos/v%2F1/parts',
        request: { method: 'POST', json: { numbers: [2, 3] } },
      },
      { kind: 'list', path: '/videos/v%2F1/parts', request: undefined },
    ])
  })

  it('completes with the ordered etags, deletes with 204, lists by purpose, requests playback', async () => {
    const { client, calls } = recordingClient()
    const api = createVideoApi(client, { basePath: '/files/videos/' })
    await api.complete('v1', [{ n: 1, etag: '"a"' }])
    await api.remove('v1')
    await api.list('clip')
    await api.playback('v1')
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/files/videos/v1/complete',
        request: { method: 'POST', json: { parts: [{ n: 1, etag: '"a"' }] } },
      },
      { kind: 'noContent', path: '/files/videos/v1', request: { method: 'DELETE' } },
      { kind: 'list', path: '/files/videos', request: { params: { purpose: 'clip' } } },
      { kind: 'value', path: '/files/videos/v1/playback', request: { method: 'POST' } },
    ])
  })
})
