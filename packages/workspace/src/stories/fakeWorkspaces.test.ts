import { isErrorCode } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createFakeWorkspaces, FAKE_TOKENS, ME } from './fakeWorkspaces'

describe('createFakeWorkspaces (the in-memory server behind the stories — same rules as the real one)', () => {
  it('resolves an old slug to the workspace with its current slug, and a stranger to 404', async () => {
    const { api } = createFakeWorkspaces()
    await api.update('ws_1', { slug: 'acme-inc' })
    expect((await api.bySlug('acme')).slug).toBe('acme-inc')
    await expect(api.bySlug('nope')).rejects.toSatisfy((e) => isErrorCode(e, 'WORKSPACE.NOT_FOUND'))
  })

  it('refuses a slug another workspace uses, or has used (409)', async () => {
    const { api } = createFakeWorkspaces()
    await expect(api.update('ws_1', { slug: 'globex' })).rejects.toSatisfy((e) =>
      isErrorCode(e, 'WORKSPACE.SLUG_TAKEN'),
    )
  })

  it('the owner cannot leave; after a transfer they are an admin and can', async () => {
    const { api } = createFakeWorkspaces()
    await expect(api.leave('ws_1')).rejects.toSatisfy((e) =>
      isErrorCode(e, 'WORKSPACE.OWNER_CANNOT_LEAVE'),
    )
    await api.transfer('ws_1', 'acc_ann')
    const roles = Object.fromEntries((await api.members('ws_1')).map((m) => [m.accountId, m.role]))
    expect(roles[ME]).toBe('ADMIN')
    expect(roles.acc_ann).toBe('OWNER')
    await api.leave('ws_1')
    expect((await api.list()).map((w) => w.id)).not.toContain('ws_1')
  })

  it('create picks the slug from the name and makes the creator the owner', async () => {
    const { api } = createFakeWorkspaces()
    const made = await api.create({ name: 'Acme' })
    expect(made.slug).toBe('acme-2')
    expect(made.role).toBe('OWNER')
  })

  it('invite: an address already waiting is skipped, and the seat limit stops the rest (members + waiting)', async () => {
    const { api } = createFakeWorkspaces({ seatLimit: 7 }) // 5 members + 1 live invitation
    const out = await api.invite('ws_1', {
      emails: ['live@example.com', 'a@example.com', 'b@example.com'],
      role: 'MEMBER',
    })
    expect(out).toEqual({
      invited: ['a@example.com'],
      alreadyInvited: ['live@example.com'],
      seatLimited: ['b@example.com'],
      alreadyMember: [],
    })
    expect((await api.get('ws_1')).pendingInvitations).toBe(2)
  })

  it('a fresh invitation cannot be resent at once (429), an older one can', async () => {
    const { api } = createFakeWorkspaces()
    await api.resendInvitation('ws_1', 'wsi_live')
    await expect(api.resendInvitation('ws_1', 'wsi_live')).rejects.toSatisfy((e) =>
      isErrorCode(e, 'WORKSPACE.RESEND_TOO_SOON'),
    )
  })

  it('accepting the good token makes me a member of Initech; a dead one says why', async () => {
    const { api } = createFakeWorkspaces()
    expect((await api.acceptInvitation(FAKE_TOKENS.ok)).slug).toBe('initech')
    expect((await api.list()).map((w) => w.slug)).toContain('initech')
    await expect(api.previewInvitation(FAKE_TOKENS.expired)).rejects.toSatisfy((e) =>
      isErrorCode(e, 'WORKSPACE.INVITATION_INVALID'),
    )
  })
})
