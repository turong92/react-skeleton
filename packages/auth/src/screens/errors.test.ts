import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { authErrorMessage, displayNameRateLimited, secondsLeft } from './errors'
import { PkceUnavailableError } from '../pkce'
import { defaultAuthLabels as L } from './labels'

const err = (code: string, status: number, data?: unknown) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't', data }, 'trace-1', 's', 'p')

describe('authErrorMessage', () => {
  it.each([
    ['AUTH.INVALID_CREDENTIALS', 401, L.errorInvalidCredentials],
    ['AUTH.EMAIL_NOT_VERIFIED', 403, L.errorEmailNotVerified],
    ['AUTH.ACCOUNT_SUSPENDED', 403, L.errorSuspended],
    ['AUTH.ACCOUNT_DELETION_PENDING', 403, L.errorDeletionPending],
    ['ACCOUNT.SUSPENDED_CANNOT_DELETE', 403, L.errorSuspendedCannotDelete],
    ['ACCOUNT.REGISTRATION_BLOCKED', 403, L.errorRegistrationBlocked],
    ['ACCOUNT.TOKEN_INVALID', 410, L.errorTokenInvalid],
    ['ACCOUNT.EMAIL_TAKEN', 409, L.errorEmailTaken],
    ['ACCOUNT.SIGN_UP_CLOSED', 403, L.errorSignUpClosed],
    ['ACCOUNT.DISPLAY_NAME_TAKEN', 409, L.errorDisplayNameTaken],
    ['ACCOUNT.CAPTCHA_FAILED', 400, L.errorCaptcha],
    ['ACCOUNT.CURRENT_PASSWORD_INVALID', 400, L.errorCurrentPassword],
    ['ACCOUNT.REAUTH_FAILED', 400, L.errorReauth],
    ['ACCOUNT.REAUTH_REQUIRED', 403, L.errorReauthRequired],
    ['ACCOUNT.LAST_SIGN_IN_METHOD', 409, L.errorLastMethod],
    ['ACCOUNT.LAST_ADMIN', 409, L.errorLastAdmin],
    ['ACCOUNT.SELF_ACTION_FORBIDDEN', 409, L.errorSelfAction],
    ['ACCOUNT.IDENTITY_TAKEN', 409, L.errorIdentityTaken],
    ['ACCOUNT.IDENTITY_EXISTS', 409, L.errorIdentityExists],
    ['ACCOUNT.SOCIAL_EMAIL_CONFLICT', 409, L.errorSocialConflict],
    ['AUTH.SOCIAL_PKCE_FAILED', 400, L.errorSocialRequest],
    ['AUTH.SOCIAL_NONCE_FAILED', 400, L.errorSocialRequest],
    ['AUTH.SOCIAL_ID_TOKEN_INVALID', 401, L.errorSocialCode],
    ['AUTH_SOCIAL.INVALID_AUTHORIZATION_CODE', 401, L.errorSocialCode],
    ['AUTH_SOCIAL.PROVIDER_GATEWAY_ERROR', 502, L.errorSocialGateway],
    ['LEGAL.CONSENT_REQUIRED', 400, L.errorConsentRequired],
    ['COMMON.VALIDATION_FAILED', 400, L.errorValidation],
    ['CLIENT.NETWORK_ERROR', 0, L.errorNetwork],
    ['COMMON.INTERNAL_SERVER_ERROR', 500, L.errorGeneric],
  ])('%s → its label', (code, status, label) => {
    expect(authErrorMessage(err(code, status), L).message).toBe(label)
  })

  it('a browser without WebCrypto gets a clear message, not the generic one', () => {
    expect(authErrorMessage(new PkceUnavailableError(), L).message).toBe(L.errorPkceUnavailable)
  })

  it('429 names the wait and carries retryAfterSeconds for a countdown', () => {
    const result = authErrorMessage(err('ACCOUNT.RATE_LIMITED', 429, { retryAfterSeconds: 90 }), L)
    expect(result.message).toBe(`${L.errorRateLimited} ${L.errorRetryIn(90)}`)
    expect(result.retryAfterSeconds).toBe(90)
  })

  it('AUTH.TOO_MANY_REFRESHES says the session is fine and names the wait (transient, never a sign-out)', () => {
    const result = authErrorMessage(
      err('AUTH.TOO_MANY_REFRESHES', 429, { retryAfterSeconds: 45 }),
      L,
    )
    expect(result.message).toBe(`${L.errorTooManyRefreshes} ${L.errorRetryIn(45)}`)
    expect(result.retryAfterSeconds).toBe(45)
  })

  it('login throttling uses its own sentence', () => {
    expect(
      authErrorMessage(err('AUTH.TOO_MANY_ATTEMPTS', 429, { retryAfterSeconds: 5 }), L).message,
    ).toBe(`${L.errorTooManyAttempts} ${L.errorRetryIn(5)}`)
  })

  it('a 429 without a wait time still reads well', () => {
    expect(authErrorMessage(err('ACCOUNT.RATE_LIMITED', 429), L).message).toBe(L.errorRateLimited)
  })

  it('keeps the trace id as a reference for support (generic failures only)', () => {
    expect(authErrorMessage(err('COMMON.INTERNAL_SERVER_ERROR', 500), L).reference).toBe('trace-1')
    expect(authErrorMessage(err('AUTH.INVALID_CREDENTIALS', 401), L).reference).toBeUndefined()
  })

  it('anything that is not an ApiRequestError is generic', () => {
    expect(authErrorMessage(new Error('x'), L).message).toBe(L.errorGeneric)
  })

  it('exposes the code for callers that branch (e.g. unverified → resend)', () => {
    expect(authErrorMessage(err('AUTH.EMAIL_NOT_VERIFIED', 403), L).code).toBe(
      'AUTH.EMAIL_NOT_VERIFIED',
    )
  })
})

describe('secondsLeft', () => {
  it('rounds up and never goes below zero', () => {
    expect(secondsLeft(10_000, 8_200)).toBe(2)
    expect(secondsLeft(10_000, 10_000)).toBe(0)
    expect(secondsLeft(10_000, 12_000)).toBe(0)
  })
})

describe('FINAL-5 review: nickname change limit and admin erase codes', () => {
  it('a 429 on a nickname change names the wait in hours and minutes (displayNameRateLimited)', () => {
    const message = displayNameRateLimited(
      err('ACCOUNT.RATE_LIMITED', 429, { retryAfterSeconds: 3 * 3600 + 12 * 60 }),
      L,
    )
    expect(message).toBe(
      L.errorDisplayNameRateLimited(`${L.durationHours(3)} ${L.durationMinutes(12)}`),
    )
    expect(
      displayNameRateLimited(err('ACCOUNT.RATE_LIMITED', 429, { retryAfterSeconds: 40 }), L),
    ).toBe(L.errorDisplayNameRateLimited(L.durationSeconds(40)))
    expect(displayNameRateLimited(err('ACCOUNT.DISPLAY_NAME_TAKEN', 409), L)).toBeUndefined()
  })

  it.each([
    ['ACCOUNT.ERASURE_IN_PROGRESS', 409, L.errorErasureInProgress],
    ['ACCOUNT.ERASURE_RETRY', 503, L.errorErasureRetry],
    ['ACCOUNT.NOT_SUSPENDED', 409, L.errorNotSuspended],
    ['ACCOUNT.ERASED', 410, L.errorErased],
  ])('%s → its label', (code, status, label) => {
    expect(authErrorMessage(err(code, status), L).message).toBe(label)
  })
})
