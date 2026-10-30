import { describe, expect, it } from 'vitest'
import { apiError } from '../test/apiFixtures'
import { mfaRequiredOf } from './mfaRequired'

describe('mfaRequiredOf (403 AUTH.MFA_REQUIRED of a correct first step)', () => {
  it('reads the token, the methods and the expiry', () => {
    const error = apiError('AUTH.MFA_REQUIRED', 403, {
      mfaToken: 'opaque',
      methods: ['totp', 'recovery_code'],
      expiresAt: '2026-10-31T00:05:00Z',
    })
    expect(mfaRequiredOf(error)).toEqual({
      mfaToken: 'opaque',
      methods: ['totp', 'recovery_code'],
      expiresAt: '2026-10-31T00:05:00Z',
    })
  })

  it('falls back to both methods and no expiry when the server leaves them out', () => {
    expect(mfaRequiredOf(apiError('AUTH.MFA_REQUIRED', 403, { mfaToken: 'opaque' }))).toEqual({
      mfaToken: 'opaque',
      methods: ['totp', 'recovery_code'],
      expiresAt: null,
    })
  })

  it('drops methods this screen cannot do (a future "webauthn")', () => {
    const error = apiError('AUTH.MFA_REQUIRED', 403, {
      mfaToken: 'opaque',
      methods: ['webauthn', 'totp'],
    })
    expect(mfaRequiredOf(error)?.methods).toEqual(['totp'])
  })

  it('is null for other errors, and without a token there is nothing to continue with', () => {
    expect(mfaRequiredOf(apiError('AUTH.INVALID_CREDENTIALS', 401))).toBeNull()
    expect(mfaRequiredOf(apiError('AUTH.MFA_REQUIRED', 403, {}))).toBeNull()
    expect(mfaRequiredOf(apiError('AUTH.MFA_REQUIRED', 403))).toBeNull()
    expect(mfaRequiredOf(new Error('x'))).toBeNull()
  })
})
