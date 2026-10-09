import { describe, expect, it } from 'vitest'
import { isErasedAccount, isErasedAccountId } from './erasedAccount'

describe('isErasedAccountId (the backend writes deleted:<16 hex> in place of a closed account when erasure.account-id=TOMBSTONE)', () => {
  it('knows the stand-in value and nothing else', () => {
    expect(isErasedAccountId('deleted:3f9a1c0b7d2e4a55')).toBe(true)
    expect(isErasedAccountId('acc_1')).toBe(false)
    expect(isErasedAccountId('')).toBe(false)
    expect(isErasedAccountId(null)).toBe(false)
    expect(isErasedAccountId(undefined)).toBe(false)
  })
})

describe('isErasedAccount (the order says it: accountErasedAt first, the stand-in id as well)', () => {
  it('a closed-at time on the order is enough, whatever the id looks like (the default KEEP mode keeps the original id)', () => {
    expect(isErasedAccount({ accountId: 'acc_1', accountErasedAt: '2026-01-01T00:00:00Z' })).toBe(
      true,
    )
  })

  it('the stand-in id still counts (TOMBSTONE mode), also when the field is missing or null', () => {
    expect(isErasedAccount({ accountId: 'deleted:3f9a1c0b7d2e4a55' })).toBe(true)
    expect(isErasedAccount({ accountId: 'deleted:3f9a1c0b7d2e4a55', accountErasedAt: null })).toBe(
      true,
    )
  })

  it('an ordinary account is not closed: no time, no stand-in', () => {
    expect(isErasedAccount({ accountId: 'acc_1' })).toBe(false)
    expect(isErasedAccount({ accountId: 'acc_1', accountErasedAt: null })).toBe(false)
    expect(isErasedAccount({ accountId: null, accountErasedAt: null })).toBe(false)
  })
})
