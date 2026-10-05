import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import {
  createStorageApi,
  publicUrlFromBase,
  publicUrlFromDownload,
  publicUrlFromEndpoint,
  storageEndpoints,
} from './storageApi'

type Call = { path: string; request?: ApiRequest }

function fakeClient(reply: (path: string) => unknown) {
  const calls: Call[] = []
  return {
    calls,
    client: {
      value: async <T>(path: string, request?: ApiRequest) => {
        calls.push({ path, request })
        return reply(path) as T
      },
    },
  }
}

const candidate = { fileName: 'cat.png', contentType: 'image/png', sizeBytes: 12 }
const endpoints = {
  presign: '/files/presign',
  validate: '/files/validate',
  multipart: {
    start: '/files/multipart/start',
    part: '/files/multipart/part',
    complete: '/files/multipart/complete',
    abort: '/files/multipart/abort',
  },
}

describe('createStorageApi (shapes mirror kotlin-skeleton modules/storage PresignedStorage)', () => {
  it('presignUpload → POST <presign> {fileName, contentType, sizeBytes}, returns a PresignedUrl with a plain string key', async () => {
    const { client, calls } = fakeClient(() => ({
      key: 'uploads/cat.png',
      method: 'PUT',
      url: 'https://bucket.s3.test/uploads/cat.png?sig=1',
      headers: { 'x-amz-meta-owner': 'u1' },
      expiresAt: '2026-06-12T00:10:00Z',
    }))
    const presigned = await createStorageApi(client, endpoints).presignUpload(candidate)
    expect(calls).toEqual([
      { path: '/files/presign', request: { method: 'POST', json: candidate } },
    ])
    expect(presigned).toEqual({
      key: 'uploads/cat.png',
      method: 'PUT',
      url: 'https://bucket.s3.test/uploads/cat.png?sig=1',
      headers: { 'x-amz-meta-owner': 'u1' },
    })
  })

  it('an ObjectKey serialised as { value } is read as the plain key; missing method/headers default to PUT / none', async () => {
    const { client } = fakeClient(() => ({ key: { value: 'a/b.png' }, url: 'https://s3.test/x' }))
    const presigned = await createStorageApi(client, endpoints).presignUpload(candidate)
    expect(presigned).toEqual({
      key: 'a/b.png',
      method: 'PUT',
      url: 'https://s3.test/x',
      headers: {},
    })
  })

  it('validate → POST <validate>, returns the errors (empty when valid)', async () => {
    const { client, calls } = fakeClient(() => ({
      valid: false,
      errors: [{ code: 'SIZE_TOO_LARGE', message: 'too big' }],
    }))
    const result = await createStorageApi(client, endpoints).validate!(candidate)
    expect(calls[0]).toEqual({
      path: '/files/validate',
      request: { method: 'POST', json: candidate },
    })
    expect(result).toEqual([{ code: 'SIZE_TOO_LARGE', message: 'too big' }])
  })

  it('multipart: start / part / complete / abort bodies follow the Kotlin request DTOs', async () => {
    const replies: Record<string, unknown> = {
      '/files/multipart/start': { key: 'k', uploadId: 'up-1' },
      '/files/multipart/part': {
        key: 'k',
        uploadId: 'up-1',
        partNumber: 2,
        method: 'PUT',
        url: 'https://s3.test/p2',
        headers: {},
      },
      '/files/multipart/complete': { key: 'k', uploadId: 'up-1', eTag: 'abc', versionId: null },
      '/files/multipart/abort': {},
    }
    const { client, calls } = fakeClient((path) => replies[path])
    const multipart = createStorageApi(client, endpoints).multipart!
    expect(await multipart.start(candidate)).toEqual({ key: 'k', uploadId: 'up-1' })
    expect(
      await multipart.presignPart({ key: 'k', uploadId: 'up-1', partNumber: 2, contentLength: 5 }),
    ).toMatchObject({
      partNumber: 2,
      url: 'https://s3.test/p2',
      method: 'PUT',
    })
    await multipart.complete({ key: 'k', uploadId: 'up-1', parts: [{ partNumber: 1, eTag: 'e1' }] })
    await multipart.abort({ key: 'k', uploadId: 'up-1' })
    expect(calls.map((c) => [c.path, c.request])).toEqual([
      ['/files/multipart/start', { method: 'POST', json: candidate }],
      [
        '/files/multipart/part',
        { method: 'POST', json: { key: 'k', uploadId: 'up-1', partNumber: 2, contentLength: 5 } },
      ],
      [
        '/files/multipart/complete',
        {
          method: 'POST',
          json: { key: 'k', uploadId: 'up-1', parts: [{ partNumber: 1, eTag: 'e1' }] },
        },
      ],
      ['/files/multipart/abort', { method: 'POST', json: { key: 'k', uploadId: 'up-1' } }],
    ])
  })

  it('only the endpoints you give exist: no validate / multipart members otherwise', () => {
    const { client } = fakeClient(() => ({}))
    const api = createStorageApi(client, { presign: '/p' })
    expect(api.validate).toBeUndefined()
    expect(api.multipart).toBeUndefined()
  })
})

describe('public URL resolvers', () => {
  it('publicUrlFromBase joins a CDN base and the key, encoding each segment', () => {
    const resolve = publicUrlFromBase('https://cdn.test/uploads/')
    expect(resolve('images/my cat.png')).toBe('https://cdn.test/uploads/images/my%20cat.png')
  })

  it('publicUrlFromEndpoint asks GET <path>?key= and returns publicUrl, or null when not available', async () => {
    const calls: Call[] = []
    const client = {
      value: async <T>(path: string, request?: ApiRequest) => {
        calls.push({ path, request })
        return (
          path.includes('missing')
            ? { key: 'k', publicUrl: null, available: false }
            : { key: 'k', publicUrl: 'https://cdn.test/k', available: true }
        ) as T
      },
    }
    expect(await publicUrlFromEndpoint(client, '/files/public-url')('k')).toBe('https://cdn.test/k')
    expect(calls[0]).toEqual({ path: '/files/public-url', request: { params: { key: 'k' } } })
    expect(await publicUrlFromEndpoint(client, '/missing')('k')).toBeNull()
  })
})

describe('default endpoints (kotlin-skeleton modules/storage opens /api/v1/storage/*)', () => {
  it('storageEndpoints() names every path the backend module opens, relative to the client baseUrl', () => {
    expect(storageEndpoints()).toEqual({
      presign: '/storage/presign',
      validate: '/storage/validate',
      download: '/storage/presign-download',
      multipart: {
        start: '/storage/multipart/start',
        part: '/storage/multipart/part',
        complete: '/storage/multipart/complete',
        abort: '/storage/multipart/abort',
      },
    })
  })

  it('storageEndpoints(basePath) re-roots them for an app that mounted the controller elsewhere', () => {
    expect(storageEndpoints('/files/').presign).toBe('/files/presign')
    expect(storageEndpoints('/files').multipart.abort).toBe('/files/multipart/abort')
  })

  it('createStorageApi(client) with no endpoints uses the defaults: presign, validate, download and multipart exist', async () => {
    const { client, calls } = fakeClient((path) =>
      path.endsWith('/presign-download')
        ? { key: 'uploads/u/cat.png', method: 'GET', url: 'https://s3.test/get?sig=1' }
        : { key: 'uploads/u/cat.png', url: 'https://s3.test/put?sig=1' },
    )
    const api = createStorageApi(client)
    await api.presignUpload(candidate)
    expect(calls[0]?.path).toBe('/storage/presign')
    expect(api.validate).toBeTypeOf('function')
    expect(api.multipart).toBeDefined()
    expect(await api.presignDownload?.('uploads/u/cat.png')).toBe('https://s3.test/get?sig=1')
    expect(calls[1]).toEqual({
      path: '/storage/presign-download',
      request: { method: 'POST', json: { key: 'uploads/u/cat.png' } },
    })
  })

  it('publicUrlFromDownload turns a key into a short-lived download URL (private buckets have no public URL)', async () => {
    const { client } = fakeClient(() => ({
      key: 'k',
      method: 'GET',
      url: 'https://s3.test/get?sig=2',
    }))
    const resolve = publicUrlFromDownload(createStorageApi(client))
    expect(await resolve('uploads/u/cat.png')).toBe('https://s3.test/get?sig=2')
  })

  it('publicUrlFromDownload names the missing endpoint when the api has no download path', () => {
    const { client } = fakeClient(() => ({}))
    const api = createStorageApi(client, { presign: '/files/presign' })
    expect(() => publicUrlFromDownload(api)).toThrow(/download/)
  })
})
