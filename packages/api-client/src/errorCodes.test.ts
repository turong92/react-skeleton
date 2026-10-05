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
