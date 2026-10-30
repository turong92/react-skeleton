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

describe('createWorkspaceApi — invitations (spec §5)', () => {
  it('invite reads a reply without alreadyMember (older server) as an empty list', async () => {
    const { client } = recordingClient({
      invited: ['a@example.com'],
      alreadyInvited: [],
      seatLimited: [],
    })
    const result = await createWorkspaceApi(client).invite('ws_1', {
      emails: ['a@example.com'],
      role: 'MEMBER',
    })
    expect(result.alreadyMember).toEqual([])
    expect(result.invited).toEqual(['a@example.com'])
  })

  it('invitations → GET /workspaces/{id}/invitations; invite → POST { emails, role }', async () => {
    const { client, calls } = recordingClient()
    const api = createWorkspaceApi(client)
    await api.invitations('ws_1')
    await api.invite('ws_1', { emails: ['a@example.com'], role: 'MEMBER' })
    expect(calls).toEqual([
      { kind: 'list', path: '/workspaces/ws_1/invitations', request: undefined },
      {
        kind: 'value',
        path: '/workspaces/ws_1/invitations',
        request: { method: 'POST', json: { emails: ['a@example.com'], role: 'MEMBER' } },
      },
    ])
  })

  it('resend → POST …/{invId}/resend; revoke → DELETE …/{invId}; ids are path-encoded', async () => {
    const { client, calls } = recordingClient()
    const api = createWorkspaceApi(client)
    await api.resendInvitation('ws_1', 'wsi_1')
    await api.revokeInvitation('ws_1', 'a/b')
    expect(calls).toEqual([
      {
        kind: 'noContent',
        path: '/workspaces/ws_1/invitations/wsi_1/resend',
        request: { method: 'POST' },
      },
      {
        kind: 'noContent',
        path: '/workspaces/ws_1/invitations/a%2Fb',
        request: { method: 'DELETE' },
      },
    ])
  })

  it('preview and accept put the token in the BODY of /workspace-invitations (never the address — access logs)', async () => {
    const { client, calls } = recordingClient()
    const api = createWorkspaceApi(client)
    await api.previewInvitation('tok')
    await api.acceptInvitation('tok')
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/workspace-invitations/preview',
        request: { method: 'POST', json: { token: 'tok' }, skipAuth: true },
      },
      {
        kind: 'value',
        path: '/workspace-invitations/accept',
        request: { method: 'POST', json: { token: 'tok' } },
      },
    ])
  })

  it('the invitation path can be moved with invitationsPath', async () => {
    const { client, calls } = recordingClient()
    await createWorkspaceApi(client, { invitationsPath: '/x/invites/' }).previewInvitation('t')
    expect(calls[0].path).toBe('/x/invites/preview')
  })
})
