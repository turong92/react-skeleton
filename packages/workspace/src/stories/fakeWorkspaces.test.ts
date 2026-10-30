import { isErrorCode } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createFakeWorkspaces, ME } from './fakeWorkspaces'

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
})
