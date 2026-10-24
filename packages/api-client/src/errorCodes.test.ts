import { describe, expect, it } from 'vitest'
import { ErrorCodes, isErrorCode } from './errorCodes'
import { ApiRequestError, type ApiError } from './types'

function requestError(overrides: Partial<ApiError> = {}) {
  const apiError: ApiError = {
    code: 'AUTH.INVALID_CREDENTIALS',
    title: 'Invalid credentials',
    status: 401,
    timestamp: '2026-06-12T00:00:00Z',
    ...overrides,
  }
  return new ApiRequestError(apiError, 'trace', 'span', 'traceparent')
}

describe('isErrorCode', () => {
  it('matches the backend code carried by an ApiRequestError', () => {
    expect(isErrorCode(requestError(), ErrorCodes.AUTH_INVALID_CREDENTIALS)).toBe(true)
  })

  it('does not match a different code', () => {
    expect(isErrorCode(requestError(), ErrorCodes.COMMON_FORBIDDEN)).toBe(false)
  })

  it('matches when any of several codes fit', () => {
    expect(
      isErrorCode(requestError({ code: 'COMMON.FORBIDDEN', status: 403 }), [
        ErrorCodes.COMMON_UNAUTHORIZED,
        ErrorCodes.COMMON_FORBIDDEN,
      ]),
    ).toBe(true)
  })

  it('is false for errors that are not ApiRequestError', () => {
    expect(
      isErrorCode(new Error('AUTH.INVALID_CREDENTIALS'), ErrorCodes.AUTH_INVALID_CREDENTIALS),
    ).toBe(false)
    expect(isErrorCode(undefined, ErrorCodes.AUTH_INVALID_CREDENTIALS)).toBe(false)
    expect(
      isErrorCode({ apiError: { code: 'AUTH.INVALID_CREDENTIALS' } }, 'AUTH.INVALID_CREDENTIALS'),
    ).toBe(false)
  })
})

describe('ErrorCodes', () => {
  it('mirrors the codes the Kotlin skeleton defines', () => {
    expect(ErrorCodes.COMMON_VALIDATION_FAILED).toBe('COMMON.VALIDATION_FAILED')
    expect(ErrorCodes.COMMON_INTERNAL_SERVER_ERROR).toBe('COMMON.INTERNAL_SERVER_ERROR')
    expect(ErrorCodes.AUTH_INVALID_CREDENTIALS).toBe('AUTH.INVALID_CREDENTIALS')
    expect(ErrorCodes.AUTH_SOCIAL_INVALID_AUTHORIZATION_CODE).toBe(
      'AUTH_SOCIAL.INVALID_AUTHORIZATION_CODE',
    )
    expect(ErrorCodes.PAYMENT_PROVIDER_ERROR).toBe('PAYMENT.PROVIDER_ERROR')
  })

  it('has the board module codes (modules/board BoardErrorCode)', () => {
    expect(ErrorCodes.BOARD_NOT_FOUND).toBe('BOARD.NOT_FOUND')
    expect(ErrorCodes.BOARD_POST_NOT_FOUND).toBe('BOARD.POST_NOT_FOUND')
    expect(ErrorCodes.BOARD_COMMENT_NOT_FOUND).toBe('BOARD.COMMENT_NOT_FOUND')
    expect(ErrorCodes.BOARD_FORBIDDEN).toBe('BOARD.FORBIDDEN')
    expect(ErrorCodes.BOARD_REACTION_TYPE_INVALID).toBe('BOARD.REACTION_TYPE_INVALID')
    expect(ErrorCodes.BOARD_COMMENT_TOO_DEEP).toBe('BOARD.COMMENT_TOO_DEEP')
    expect(ErrorCodes.BOARD_CONTENT_INVALID).toBe('BOARD.CONTENT_INVALID')
    expect(ErrorCodes.BOARD_POST_NOT_COMMENTABLE).toBe('BOARD.POST_NOT_COMMENTABLE')
    expect(ErrorCodes.BOARD_CODE_TAKEN).toBe('BOARD.CODE_TAKEN')
    expect(ErrorCodes.BOARD_RATE_LIMITED).toBe('BOARD.RATE_LIMITED')
    expect(ErrorCodes.BOARD_REVISION_CHANGED).toBe('BOARD.REVISION_CHANGED')
    expect(ErrorCodes.BOARD_AUTHOR_REQUIRED).toBe('BOARD.AUTHOR_REQUIRED')
    expect(ErrorCodes.BOARD_AUTHOR_NOT_ALLOWED).toBe('BOARD.AUTHOR_NOT_ALLOWED')
  })

  it('has unique values, each shaped DOMAIN.REASON', () => {
    const values = Object.values(ErrorCodes)
    expect(new Set(values).size).toBe(values.length)
    values.forEach((value) => expect(value).toMatch(/^[A-Z_]+\.[A-Z_]+$/))
  })
})

describe('storage error codes (kotlin-skeleton modules/storage StorageErrorCode)', () => {
  it('names the codes the upload endpoints answer with', () => {
    expect(ErrorCodes.STORAGE_FILE_REJECTED).toBe('STORAGE.FILE_REJECTED')
    expect(ErrorCodes.STORAGE_OBJECT_NOT_FOUND).toBe('STORAGE.OBJECT_NOT_FOUND')
    expect(ErrorCodes.STORAGE_UNAUTHENTICATED).toBe('STORAGE.UNAUTHENTICATED')
  })
})

describe('re-authentication codes (account contract FINAL-2)', () => {
  it('knows ACCOUNT.REAUTH_REQUIRED', () => {
    expect(ErrorCodes.ACCOUNT_REAUTH_REQUIRED).toBe('ACCOUNT.REAUTH_REQUIRED')
  })
})

describe('refresh back-off code', () => {
  it('names AUTH.TOO_MANY_REFRESHES (429, the session stays valid)', () => {
    expect(ErrorCodes.AUTH_TOO_MANY_REFRESHES).toBe('AUTH.TOO_MANY_REFRESHES')
  })
})

describe('author-profile codes (kotlin-skeleton modules/author-profile)', () => {
  it('carries the four codes the module sends', () => {
    expect([
      ErrorCodes.AUTHOR_PROFILE_NAME_TAKEN,
      ErrorCodes.AUTHOR_PROFILE_LIMIT_REACHED,
      ErrorCodes.AUTHOR_PROFILE_RATE_LIMITED,
      ErrorCodes.AUTHOR_PROFILE_NOT_FOUND,
    ]).toEqual([
      'AUTHOR_PROFILE.NAME_TAKEN',
      'AUTHOR_PROFILE.LIMIT_REACHED',
      'AUTHOR_PROFILE.RATE_LIMITED',
      'AUTHOR_PROFILE.NOT_FOUND',
    ])
  })
})

describe('login id codes (account contract FINAL-7 L12)', () => {
  it('names the three codes the login id endpoints answer with', () => {
    expect(ErrorCodes.ACCOUNT_LOGIN_ID_TAKEN).toBe('ACCOUNT.LOGIN_ID_TAKEN') // 409
    expect(ErrorCodes.ACCOUNT_LOGIN_ID_REQUIRED).toBe('ACCOUNT.LOGIN_ID_REQUIRED') // 403
    expect(ErrorCodes.ACCOUNT_LOGIN_ID_ALREADY_SET).toBe('ACCOUNT.LOGIN_ID_ALREADY_SET') // 409
  })
})

describe('authz codes (kotlin-skeleton modules/authz, docs/authz-http-contract.md)', () => {
  it('names the seven role-management codes and the two account role-grant codes', () => {
    expect([
      ErrorCodes.AUTHZ_ROLE_PROTECTED,
      ErrorCodes.AUTHZ_ROLE_IN_USE,
      ErrorCodes.AUTHZ_ROLE_EXISTS,
      ErrorCodes.AUTHZ_ROLE_NOT_FOUND,
      ErrorCodes.AUTHZ_PERMISSION_UNKNOWN,
      ErrorCodes.AUTHZ_ESCALATION,
      ErrorCodes.AUTHZ_SELF_LOCKOUT,
      ErrorCodes.ACCOUNT_ROLE_UNKNOWN,
      ErrorCodes.ACCOUNT_ROLE_ESCALATION,
    ]).toEqual([
      'AUTHZ.ROLE_PROTECTED',
      'AUTHZ.ROLE_IN_USE',
      'AUTHZ.ROLE_EXISTS',
      'AUTHZ.ROLE_NOT_FOUND',
      'AUTHZ.PERMISSION_UNKNOWN',
      'AUTHZ.ESCALATION',
      'AUTHZ.SELF_LOCKOUT',
      'ACCOUNT.ROLE_UNKNOWN',
      'ACCOUNT.ROLE_ESCALATION',
    ])
  })
})
