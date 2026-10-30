import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createAdminApiKeysApi } from '../admin/adminApiKeysApi'
import { createApiKeysApi } from './apiKeysApi'

type Call = { kind: string; path: string; request?: ApiRequest }
function fake() {
  const calls: Call[] = []
  const rec = (kind: string) => async (path: string, request?: ApiRequest) => {
    calls.push({ kind, path, request })
    return [] as never
  }
  return {
    calls,
    client: {
      list: rec('list'),
      value: rec('value'),
      cursor: rec('cursor'),
      noContent: rec('noContent'),
    },
  }
}

describe('createApiKeysApi (backend: skeleton.api-key.http.enabled)', () => {
  it('list → GET /api-keys, scopes → GET /api-keys/scopes', async () => {
    const { client, calls } = fake()
    const api = createApiKeysApi(client)
    await api.list()
    await api.scopes()
    expect(calls).toEqual([
      { kind: 'list', path: '/api-keys', request: undefined },
      { kind: 'list', path: '/api-keys/scopes', request: undefined },
    ])
  })
  it('create → POST /api-keys with name, scopes, expiresAt and the reauth proof in the same body', async () => {
    const { client, calls } = fake()
    await createApiKeysApi(client).create({
      name: 'ci',
      scopes: ['notes.read'],
      expiresAt: '2027-01-01T00:00:00Z',
      currentPassword: 'pw',
    })
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/api-keys',
      request: {
        method: 'POST',
        json: {
          name: 'ci',
          scopes: ['notes.read'],
          expiresAt: '2027-01-01T00:00:00Z',
          currentPassword: 'pw',
        },
      },
    })
  })
  it('revoke → DELETE /api-keys/{id} (204), the id is encoded', async () => {
    const { client, calls } = fake()
    await createApiKeysApi(client).revoke('key_a/b')
    expect(calls[0]).toEqual({
      kind: 'noContent',
      path: '/api-keys/key_a%2Fb',
      request: { method: 'DELETE' },
    })
  })
})

describe('createAdminApiKeysApi (backend: skeleton.api-key.admin.enabled, api-key.read / api-key.revoke)', () => {
  it('list → GET /admin/api-keys as a cursor list, sending only the filters that are set', async () => {
    const { client, calls } = fake()
    const api = createAdminApiKeysApi(client)
    await api.list({ ownerId: 'acc_1', status: 'ACTIVE', cursor: 'c1', size: 20 })
    await api.list({})
    expect(calls[0]).toEqual({
      kind: 'cursor',
      path: '/admin/api-keys',
      request: { params: { ownerId: 'acc_1', status: 'ACTIVE', cursor: 'c1', size: 20 } },
    })
    expect(calls[1]).toEqual({ kind: 'cursor', path: '/admin/api-keys', request: { params: {} } })
  })
  it('revoke → POST /admin/api-keys/{id}/revoke with the reason', async () => {
    const { client, calls } = fake()
    await createAdminApiKeysApi(client).revoke('key_1', '유출 신고')
    expect(calls[0]).toEqual({
      kind: 'noContent',
      path: '/admin/api-keys/key_1/revoke',
      request: { method: 'POST', json: { reason: '유출 신고' } },
    })
  })
})
