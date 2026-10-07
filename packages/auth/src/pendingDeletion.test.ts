import { describe, expect, it } from 'vitest'
import { apiError } from './test/apiFixtures'
import { deletionPendingOf } from './pendingDeletion'

describe('deletionPendingOf (403 AUTH.ACCOUNT_DELETION_PENDING of a correct sign-in during the grace)', () => {
  it('reads purgeAfter and the restore token with its expiry', () => {
    const error = apiError('AUTH.ACCOUNT_DELETION_PENDING', 403, {
      purgeAfter: '2026-11-05T00:00:00Z',
      restoreToken: 'opaque',
      restoreTokenExpiresAt: '2026-10-07T08:15:00Z',
    })
    expect(deletionPendingOf(error)).toEqual({
      purgeAfter: '2026-11-05T00:00:00Z',
      restoreToken: 'opaque',
      restoreTokenExpiresAt: '2026-10-07T08:15:00Z',
    })
  })

  it('has no token when the server has self-restore off — the screen then only informs', () => {
    const error = apiError('AUTH.ACCOUNT_DELETION_PENDING', 403, {
      purgeAfter: '2026-11-05T00:00:00Z',
    })
    expect(deletionPendingOf(error)).toEqual({ purgeAfter: '2026-11-05T00:00:00Z' })
  })

  it('still recognises the code when the data is missing or malformed (no date, no token)', () => {
    expect(deletionPendingOf(apiError('AUTH.ACCOUNT_DELETION_PENDING', 403))).toEqual({
      purgeAfter: null,
    })
    expect(
      deletionPendingOf(
        apiError('AUTH.ACCOUNT_DELETION_PENDING', 403, { purgeAfter: 5, restoreToken: '' }),
      ),
    ).toEqual({ purgeAfter: null })
  })

  it('is null for any other error', () => {
    expect(deletionPendingOf(apiError('AUTH.ACCOUNT_SUSPENDED', 403))).toBeNull()
    expect(deletionPendingOf(new Error('AUTH.ACCOUNT_DELETION_PENDING'))).toBeNull()
    expect(deletionPendingOf(undefined)).toBeNull()
  })
})
