import { describe, expect, it } from 'vitest'
import type { AdminRole } from './rolesApi'
import { inheritedFrom, wouldCycle } from './roleIncludes'

const role = (name: string, permissions: string[], includes: string[] = []): AdminRole => ({
  name,
  description: null,
  permissions,
  protected: false,
  holders: null,
  includes,
  effectivePermissions: permissions,
})

describe('wouldCycle', () => {
  const roles = [role('A', [], ['B']), role('B', []), role('C', [], ['A'])]
  it('a role cannot include itself', () => {
    expect(wouldCycle(roles, 'B', 'B')).toBe(true)
  })
  it('B including A closes the loop when A already includes B', () => {
    expect(wouldCycle(roles, 'B', 'A')).toBe(true)
  })
  it('follows a chain: B including C is a loop through C → A → B', () => {
    expect(wouldCycle(roles, 'B', 'C')).toBe(true)
  })
  it('a candidate that cannot reach the role is fine', () => {
    expect(wouldCycle(roles, 'C', 'B')).toBe(false)
    expect(wouldCycle(roles, 'NEW', 'A')).toBe(false)
  })
  it('a role without an includes list (older server) has no edges', () => {
    const plain = [{ ...role('A', []), includes: undefined }, role('B', [])]
    expect(wouldCycle(plain, 'B', 'A')).toBe(false)
  })
})

describe('inheritedFrom', () => {
  it('maps each inherited permission to the first role on the chain that lists it', () => {
    const roles = [
      role('STAFF', ['board.moderate'], ['CS']),
      role('CS', ['payment.read'], ['VIEWER']),
      role('VIEWER', ['payment.read', 'account.read']),
    ]
    const map = inheritedFrom(roles, 'STAFF')
    expect(map.get('payment.read')).toBe('CS')
    expect(map.get('account.read')).toBe('VIEWER')
    expect(map.has('board.moderate')).toBe(false)
  })
  it('survives a loop and an unknown include', () => {
    const roles = [role('A', ['x'], ['B', 'GONE']), role('B', ['y'], ['A'])]
    expect([...inheritedFrom(roles, 'A')]).toEqual([['y', 'B']])
  })
  it('is empty for a role that includes nothing', () => {
    expect(inheritedFrom([role('A', ['x'])], 'A').size).toBe(0)
  })
})
