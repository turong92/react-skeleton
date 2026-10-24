import { describe, expect, it } from 'vitest'
import type { AdminAccount } from '../account/types'
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
const kinds = (a: AdminAccount, can?: (key: string) => boolean) =>
  rowActions(a, ['CS'], can).map((x) => x.kind)

describe('rowActions with `can`', () => {
  it('without can everything is offered (existing apps unchanged)', () => {
    expect(kinds(account({}))).toEqual(['suspend', 'grant:CS'])
  })
  it('no account.manage: no suspend, unsuspend or restore', () => {
    const can = (key: string) => key !== 'account.manage'
    expect(kinds(account({}), can)).toEqual(['grant:CS'])
    expect(kinds(account({ status: 'SUSPENDED' }), can)).toEqual([])
    expect(kinds(account({ status: 'DELETED' }), can)).toEqual([])
  })
  it('no account.roles: no grant or revoke', () => {
    const can = (key: string) => key !== 'account.roles'
    expect(kinds(account({ roles: ['USER', 'CS'] }), can)).toEqual(['suspend'])
  })
})
