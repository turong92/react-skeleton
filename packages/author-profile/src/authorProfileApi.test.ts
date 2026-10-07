import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createAuthorProfileApi } from './authorProfileApi'

type Call = { kind: 'value' | 'list' | 'noContent'; path: string; request?: ApiRequest }

function fakeClient(answer: unknown = {}) {
  const calls: Call[] = []
  const record = (kind: Call['kind']) => async (path: string, request?: ApiRequest) => {
    calls.push({ kind, path, request })
    return answer
  }
  return {
    calls,
    client: {
      value: record('value') as <T>(path: string, request?: ApiRequest) => Promise<T>,
      list: record('list') as <T>(path: string, request?: ApiRequest) => Promise<T[]>,
      noContent: record('noContent') as (path: string, request?: ApiRequest) => Promise<void>,
    },
  }
}

describe('createAuthorProfileApi (kotlin-skeleton modules/author-profile — see packages/author-profile/README.md)', () => {
  it('getConfig → GET /author-profiles/config', async () => {
    const { client, calls } = fakeClient()
    await createAuthorProfileApi(client).getConfig()
    expect(calls).toEqual([{ kind: 'value', path: '/author-profiles/config', request: undefined }])
  })

  it('list → GET /author-profiles as a list', async () => {
    const { client, calls } = fakeClient()
    await createAuthorProfileApi(client).list()
    expect(calls).toEqual([{ kind: 'list', path: '/author-profiles', request: undefined }])
  })

  it('create → POST /author-profiles { name } with a fresh Idempotency-Key, or the one it is given', async () => {
    const { client, calls } = fakeClient()
    const api = createAuthorProfileApi(client)
    await api.create({ name: 'Ann' })
    await api.create({ name: 'Ann' }, { idempotencyKey: 'k1' })
    expect(calls[0]).toMatchObject({ kind: 'value', path: '/author-profiles' })
    expect(calls[0].request).toMatchObject({ method: 'POST', json: { name: 'Ann' } })
    expect(calls[0].request?.idempotencyKey).toMatch(/^fe-/)
    expect(calls[1].request?.idempotencyKey).toBe('k1')
  })

  it('rename → PATCH /author-profiles/{id} { name }; the id is path-encoded', async () => {
    const { client, calls } = fakeClient()
    await createAuthorProfileApi(client).rename('prf_a/b', { name: 'Bea' })
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/author-profiles/prf_a%2Fb',
        request: { method: 'PATCH', json: { name: 'Bea' } },
      },
    ])
  })

  it('remove → DELETE /author-profiles/{id} with no content', async () => {
    const { client, calls } = fakeClient()
    await createAuthorProfileApi(client).remove('prf_a')
    expect(calls).toEqual([
      { kind: 'noContent', path: '/author-profiles/prf_a', request: { method: 'DELETE' } },
    ])
  })

  it('basePath moves every call (the module can be opened elsewhere); trailing slashes are ignored', async () => {
    const { client, calls } = fakeClient()
    await createAuthorProfileApi(client, { basePath: '/me/profiles/' }).list()
    expect(calls[0].path).toBe('/me/profiles')
  })
})
