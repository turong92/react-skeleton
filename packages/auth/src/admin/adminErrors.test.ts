import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { adminBlocked } from './adminErrors'

const err = (code: string, status: number) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't' }, 'trace', 's', 'p')

describe('adminBlocked (the backend re-checks the stored role on every call)', () => {
  it('403 means "not allowed here" — a notice, never a sign-out, even though the token still looks like an admin token', () => {
    expect(adminBlocked(err('COMMON.FORBIDDEN', 403))).toBe(true)
  })
  it('other failures are ordinary errors', () => {
    expect(adminBlocked(err('COMMON.VALIDATION_FAILED', 400))).toBe(false)
    expect(adminBlocked(err('COMMON.UNAUTHORIZED', 401))).toBe(false)
    expect(adminBlocked(new Error('x'))).toBe(false)
    expect(adminBlocked(null)).toBe(false)
  })
})
