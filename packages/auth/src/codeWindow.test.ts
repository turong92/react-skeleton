import { describe, expect, it } from 'vitest'
import { codeWindowOf, estimateCodeWindow } from './codeWindow'

describe('where the expiry of a code comes from', () => {
  it('uses the server instants when the response carries them (expiresAt / resendAvailableAt, ISO strings)', () => {
    expect(
      codeWindowOf({
        status: 'ACCEPTED',
        expiresAt: '2026-10-07T00:10:00Z',
        resendAvailableAt: '2026-10-07T00:00:30Z',
      }),
    ).toEqual({
      expiresAt: Date.parse('2026-10-07T00:10:00Z'),
      resendAvailableAt: Date.parse('2026-10-07T00:00:30Z'),
      source: 'server',
    })
  })

  it('today the backend sends neither: nothing is invented here (the caller falls back to an estimate)', () => {
    expect(codeWindowOf({ status: 'ACCEPTED' })).toBeNull()
    expect(codeWindowOf(undefined)).toBeNull()
    expect(codeWindowOf({ expiresAt: 'garbage' })).toBeNull()
  })

  it('the estimate is marked as one: the documented lifetime counted from the server-corrected now', () => {
    expect(estimateCodeWindow(1_000, { ttlSeconds: 600, cooldownSeconds: 30 })).toEqual({
      expiresAt: 601_000,
      resendAvailableAt: 31_000,
      source: 'estimate',
    })
  })
})
