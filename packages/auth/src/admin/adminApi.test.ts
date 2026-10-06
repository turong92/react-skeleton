import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createAdminAccountsApi } from './adminApi'

type Call = { kind: string; path: string; request?: ApiRequest }
function fake() {
  const calls: Call[] = []
  const rec = (kind: string) => async (path: string, request?: ApiRequest) => {
    calls.push({ kind, path, request })
    return { values: [], pagination: { page: 0 }, meta: {} } as never
  }
  return { calls, client: { page: rec('page'), value: rec('value'), noContent: rec('noContent') } }
}

describe('createAdminAccountsApi (opt-in backend: skeleton.account.admin.enabled)', () => {
  it('list → GET /admin/accounts with only the filters that are set', async () => {
    const { client, calls } = fake()
    await createAdminAccountsApi(client).list({ email: 'a@', page: 1, size: 20 })
    expect(calls[0]).toMatchObject({
      kind: 'page',
      path: '/admin/accounts',
      request: { params: { email: 'a@', page: 1, size: 20 } },
    })
    await createAdminAccountsApi(client).list({ status: 'SUSPENDED' })
    expect(calls[1].request?.params).toEqual({ status: 'SUSPENDED' })
  })

  it('paging stays inside what the backend accepts (page >= 0, 1 <= size <= 100, else 400)', async () => {
    const { client, calls } = fake()
    const api = createAdminAccountsApi(client)
    await api.list({ page: -3, size: 500 })
    await api.list({ page: 2.7, size: 0 })
    expect(calls[0].request?.params).toEqual({ page: 0, size: 100 })
    expect(calls[1].request?.params).toEqual({ page: 2, size: 1 })
  })

  it('commands hit the contract paths', async () => {
    const { client, calls } = fake()
    const api = createAdminAccountsApi(client)
    await api.get('acc_1')
    await api.suspend('acc_1', 'spam')
    await api.suspend('acc_1')
    await api.unsuspend('acc_1')
    await api.restore('acc_1')
    await api.grantRole('acc_1', 'MODERATOR')
    await api.revokeRole('acc_1', 'MODERATOR')
    expect(calls.map((c) => [c.kind, c.path, c.request?.method])).toEqual([
      ['value', '/admin/accounts/acc_1', undefined],
      ['noContent', '/admin/accounts/acc_1/suspend', 'POST'],
      ['noContent', '/admin/accounts/acc_1/suspend', 'POST'],
      ['noContent', '/admin/accounts/acc_1/unsuspend', 'POST'],
      ['noContent', '/admin/accounts/acc_1/restore', 'POST'],
      ['noContent', '/admin/accounts/acc_1/roles/MODERATOR', 'PUT'],
      ['noContent', '/admin/accounts/acc_1/roles/MODERATOR', 'DELETE'],
    ])
    expect(calls[1].request?.json).toEqual({ reason: 'spam' })
    expect(calls[2].request?.json).toEqual({})
  })
})
