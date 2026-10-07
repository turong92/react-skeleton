import { describe, expect, it } from 'vitest'
import { accountDeletedDestination } from './accountDeleted'

describe('accountDeletedDestination — /account-deleted is open, so it must not sign anybody out on its own', () => {
  it('shows the landing (and signs out) only when the deletion flow handed over the purge date', () => {
    expect(accountDeletedDestination({ purgeAfter: '2026-11-06T00:00:00Z' }, true)).toBe('landing')
    expect(accountDeletedDestination({ purgeAfter: '2026-11-06T00:00:00Z' }, false)).toBe('landing')
  })

  it('opened some other way (an outside link, a bookmark): signed-in people go home, signed-out people to sign-in', () => {
    expect(accountDeletedDestination(null, true)).toBe('home')
    expect(accountDeletedDestination({}, true)).toBe('home')
    expect(accountDeletedDestination(undefined, false)).toBe('signIn')
    expect(accountDeletedDestination({ purgeAfter: 5 }, false)).toBe('signIn')
  })
})
