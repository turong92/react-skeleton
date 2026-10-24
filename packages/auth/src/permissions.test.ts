import { describe, expect, it } from 'vitest'
import { hasPermission } from './permissions'

describe('hasPermission', () => {
  it('* passes every key', () => {
    expect(hasPermission(['*'], 'payment.refund')).toBe(true)
    expect(hasPermission(['*'], ['a.b', 'c.d'])).toBe(true)
  })
  it('an empty or missing list refuses everything', () => {
    expect(hasPermission([], 'payment.read')).toBe(false)
    expect(hasPermission(undefined, 'payment.read')).toBe(false)
    expect(hasPermission(null, 'payment.read')).toBe(false)
  })
  it('matches the exact key only', () => {
    expect(hasPermission(['payment.read'], 'payment.read')).toBe(true)
    expect(hasPermission(['payment.read'], 'payment.refund')).toBe(false)
    expect(hasPermission(['payment.read'], 'payment')).toBe(false)
  })
  it('anyOf: one match is enough', () => {
    expect(hasPermission(['account.roles'], ['authz.roles', 'account.roles'])).toBe(true)
    expect(hasPermission(['board.moderate'], ['authz.roles', 'account.roles'])).toBe(false)
    expect(hasPermission(['board.moderate'], [])).toBe(false)
  })
})
