import { describe, expect, it } from 'vitest'
import { recordingClient } from './test/recordingClient'
import { createWorkspaceApi } from './workspaceApi'

describe('createWorkspaceApi (kotlin-skeleton modules/workspace — see packages/workspace/README.md)', () => {
  it('list → GET /workspaces as a list; get → GET /workspaces/{id}', async () => {
    const { client, calls } = recordingClient()
    const api = createWorkspaceApi(client)
    await api.list()
    await api.get('ws_1')
    expect(calls).toEqual([
      { kind: 'list', path: '/workspaces', request: undefined },
      { kind: 'value', path: '/workspaces/ws_1', request: undefined },
    ])
  })

  it('bySlug → GET /workspaces/by-slug/{slug}, the slug is path-encoded', async () => {
    const { client, calls } = recordingClient()
    await createWorkspaceApi(client).bySlug('a/b')
    expect(calls).toEqual([
      { kind: 'value', path: '/workspaces/by-slug/a%2Fb', request: undefined },
    ])
  })

  it('create → POST /workspaces { name, slug? } with an Idempotency-Key a double click reuses', async () => {
    const { client, calls } = recordingClient()
    const api = createWorkspaceApi(client)
    await api.create({ name: 'Acme' })
    await api.create({ name: 'Acme', slug: 'acme' }, { idempotencyKey: 'k1' })
    expect(calls[0]).toMatchObject({ kind: 'value', path: '/workspaces' })
    expect(calls[0].request).toMatchObject({ method: 'POST', json: { name: 'Acme' } })
    expect(calls[0].request?.idempotencyKey).toMatch(/^fe-/)
    expect(calls[1].request).toMatchObject({ json: { name: 'Acme', slug: 'acme' } })
    expect(calls[1].request?.idempotencyKey).toBe('k1')
  })

  it('update → PATCH /workspaces/{id} { name?, slug? } — only what changed is sent', async () => {
    const { client, calls } = recordingClient()
    await createWorkspaceApi(client).update('ws_1', { slug: 'new-name' })
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/workspaces/ws_1',
        request: { method: 'PATCH', json: { slug: 'new-name' } },
      },
    ])
  })

  it('members, role, remove, leave and transfer use the member routes of the workspace', async () => {
    const { client, calls } = recordingClient()
    const api = createWorkspaceApi(client)
    await api.members('ws_1')
    await api.setMemberRole('ws_1', 'acc/1', 'ADMIN')
    await api.removeMember('ws_1', 'acc/1')
    await api.leave('ws_1')
    await api.transfer('ws_1', 'acc_2')
    expect(calls).toEqual([
      { kind: 'list', path: '/workspaces/ws_1/members', request: undefined },
      {
        kind: 'noContent',
        path: '/workspaces/ws_1/members/acc%2F1',
        request: { method: 'PATCH', json: { role: 'ADMIN' } },
      },
      {
        kind: 'noContent',
        path: '/workspaces/ws_1/members/acc%2F1',
        request: { method: 'DELETE' },
      },
      { kind: 'noContent', path: '/workspaces/ws_1/leave', request: { method: 'POST' } },
      {
        kind: 'noContent',
        path: '/workspaces/ws_1/transfer',
        request: { method: 'POST', json: { accountId: 'acc_2' } },
      },
    ])
  })

  it('basePath moves every call; trailing slashes are ignored', async () => {
    const { client, calls } = recordingClient()
    await createWorkspaceApi(client, { basePath: '/teams/' }).list()
    expect(calls[0].path).toBe('/teams')
  })
})
