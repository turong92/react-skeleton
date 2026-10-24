import { describe, expect, it } from 'vitest'
import type { AdminAccount } from '../account/types'
import type { AssignableRole } from './adminApi'
import { rowActions } from './rowActions'

const account = (over: Partial<AdminAccount>): AdminAccount => ({
  id: 'acc_1',
  email: 'a@b.c',
  status: 'ACTIVE',
  roles: ['USER'],
  displayName: 'Ann',
  createdAt: '2026-01-01T00:00:00Z',
  lastLoginAt: null,
  suspendedReason: null,
  purgeAfter: null,
  ...over,
})
const roles: AssignableRole[] = [
  { name: 'USER', permissions: [] },
  { name: 'CS', permissions: ['payment.read', 'payment.refund'] },
  { name: 'ADMIN', permissions: ['*'] },
]
const kinds = (a: AdminAccount, caller?: string[]) =>
  rowActions(a, roles, undefined, caller)
    .map((x) => x.kind)
    .filter((kind) => !kind.endsWith(':USER')) // 모두가 가진 기본 역할은 제쳐 둔다

describe('rowActions only offers what the server would not refuse as an escalation', () => {
  it('without caller permissions nothing is filtered (existing apps)', () => {
    expect(kinds(account({}))).toEqual(['suspend', 'grant:CS', 'grant:ADMIN'])
  })
  it('a role is offered only when its permissions are inside the caller own; the full-access role only to *', () => {
    expect(kinds(account({}), ['account.manage', 'account.roles', 'payment.read'])).toEqual([
      'suspend',
    ])
    expect(
      kinds(account({}), ['account.manage', 'payment.read', 'payment.refund']).includes('grant:CS'),
    ).toBe(true)
    expect(kinds(account({}), ['*'])).toEqual(['suspend', 'grant:CS', 'grant:ADMIN'])
  })
  it('revoking follows the same rule', () => {
    const cs = account({ roles: ['USER', 'CS'] })
    expect(kinds(cs, ['account.manage', 'payment.read'])).not.toContain('revoke:CS')
    expect(kinds(cs, ['account.manage', 'payment.read', 'payment.refund'])).toContain('revoke:CS')
  })
  it('account commands are hidden when the target holds a role beyond the caller permissions', () => {
    const admin = account({ roles: ['USER', 'ADMIN'] })
    expect(kinds(admin, ['account.manage', 'payment.read'])).toEqual([])
    expect(kinds(admin, ['*'])).toContain('suspend')
    expect(kinds(account({ status: 'SUSPENDED', roles: ['CS'] }), ['payment.read'])).toEqual([])
    expect(kinds(account({ status: 'DELETED', roles: ['CS'] }), ['payment.read'])).toEqual([])
    expect(
      kinds(account({ status: 'SUSPENDED', roles: ['CS'] }), ['payment.read', 'payment.refund']),
    ).toEqual(['unsuspend'])
  })
  it('a target role the server did not list cannot be judged, so it is hidden unless the caller has *', () => {
    const odd = account({ roles: ['MYSTERY'] })
    expect(kinds(odd, ['payment.read'])).toEqual([])
    expect(kinds(odd, ['*'])).toContain('suspend')
  })
})
