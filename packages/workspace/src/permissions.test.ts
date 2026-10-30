import { describe, expect, it } from 'vitest'
import { canManageWorkspace, memberActions, roleAtLeast } from './permissions'
import type { WorkspaceMember } from './types'

const member = (accountId: string, role: WorkspaceMember['role']): WorkspaceMember => ({
  accountId,
  label: accountId,
  role,
  joinedAt: '2026-10-01T00:00:00Z',
})

describe('roleAtLeast (OWNER > ADMIN > MEMBER)', () => {
  it('compares by rank', () => {
    expect(roleAtLeast('OWNER', 'ADMIN')).toBe(true)
    expect(roleAtLeast('ADMIN', 'ADMIN')).toBe(true)
    expect(roleAtLeast('MEMBER', 'ADMIN')).toBe(false)
    expect(canManageWorkspace('ADMIN')).toBe(true)
    expect(canManageWorkspace('MEMBER')).toBe(false)
  })
})

describe('memberActions — which buttons a row shows (the server still decides)', () => {
  const me = 'acc_me'
  it('the owner can change the role of and remove an admin or member, and hand ownership to either', () => {
    for (const role of ['ADMIN', 'MEMBER'] as const)
      expect(memberActions('OWNER', me, member('acc_x', role))).toEqual({
        changeRole: true,
        remove: true,
        transfer: true,
      })
  })
  it('an admin can remove a plain member and nothing else', () => {
    expect(memberActions('ADMIN', me, member('acc_x', 'MEMBER'))).toEqual({
      changeRole: false,
      remove: true,
      transfer: false,
    })
    expect(memberActions('ADMIN', me, member('acc_x', 'ADMIN')).remove).toBe(false)
    expect(memberActions('ADMIN', me, member('acc_x', 'OWNER')).remove).toBe(false)
  })
  it('a member has no action on anyone', () => {
    expect(memberActions('MEMBER', me, member('acc_x', 'MEMBER'))).toEqual({
      changeRole: false,
      remove: false,
      transfer: false,
    })
  })
  it('nobody acts on their own row or on the owner row (leave and transfer are separate)', () => {
    expect(memberActions('OWNER', me, member(me, 'OWNER'))).toEqual({
      changeRole: false,
      remove: false,
      transfer: false,
    })
    expect(memberActions('ADMIN', me, member(me, 'ADMIN')).remove).toBe(false)
    expect(memberActions('OWNER', me, member('acc_owner', 'OWNER')).remove).toBe(false)
  })
})
