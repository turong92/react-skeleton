import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createAdminRolesApi } from './rolesApi'

type Call = { kind: string; path: string; request?: ApiRequest }
function fake() {
  const calls: Call[] = []
  const rec = (kind: string) => async (path: string, request?: ApiRequest) => {
    calls.push({ kind, path, request })
    return [] as never
  }
  return { calls, client: { list: rec('list'), value: rec('value'), noContent: rec('noContent') } }
}

describe('createAdminRolesApi (opt-in backend: skeleton.authz.admin.enabled, contract C4)', () => {
  it('permissions → GET /admin/permissions, roles → GET /admin/roles', async () => {
    const { client, calls } = fake()
    const api = createAdminRolesApi(client)
    await api.permissions()
    await api.list()
    expect(calls).toEqual([
      { kind: 'list', path: '/admin/permissions', request: undefined },
      { kind: 'list', path: '/admin/roles', request: undefined },
    ])
  })
  it('create → POST /admin/roles with name, description and permissions', async () => {
    const { client, calls } = fake()
    await createAdminRolesApi(client).create({
      name: 'CS',
      description: 'support',
      permissions: ['payment.read', 'payment.refund'],
    })
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/admin/roles',
      request: {
        method: 'POST',
        json: {
          name: 'CS',
          description: 'support',
          permissions: ['payment.read', 'payment.refund'],
        },
      },
    })
  })
  it('update → PUT /admin/roles/{name} without the name in the body; the name is encoded', async () => {
    const { client, calls } = fake()
    await createAdminRolesApi(client).update('C S', { description: 'd', permissions: ['a.b'] })
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/admin/roles/C%20S',
      request: { method: 'PUT', json: { description: 'd', permissions: ['a.b'] } },
    })
  })
  it('create and update carry includes when given; update without it leaves the body as before', async () => {
    const { client, calls } = fake()
    const api = createAdminRolesApi(client)
    await api.create({ name: 'STAFF', description: '', permissions: [], includes: ['CS'] })
    await api.update('STAFF', { description: '', permissions: [], includes: [] })
    expect(calls[0].request).toMatchObject({ json: { includes: ['CS'] } })
    expect(calls[1].request).toMatchObject({ json: { includes: [] } })
  })
  it('remove → DELETE /admin/roles/{name}', async () => {
    const { client, calls } = fake()
    await createAdminRolesApi(client).remove('CS')
    expect(calls[0]).toEqual({
      kind: 'noContent',
      path: '/admin/roles/CS',
      request: { method: 'DELETE' },
    })
  })
})
