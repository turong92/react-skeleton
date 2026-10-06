import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { codeFailureOf } from './codeErrors'

const err = (code: string, status: number, data?: unknown) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't', data }, 't', 's', 'p')

describe('codeFailureOf — what the code step shows for each answer', () => {
  it('wrong code: 400 ACCOUNT.CODE_INVALID with the attempts left', () => {
    expect(codeFailureOf(err('ACCOUNT.CODE_INVALID', 400, { attemptsLeft: 3 }))).toEqual({
      kind: 'invalid',
      attemptsLeft: 3,
    })
  })
  it('wrong code without a counter still reads as invalid', () => {
    expect(codeFailureOf(err('ACCOUNT.CODE_INVALID', 400))).toEqual({
      kind: 'invalid',
      attemptsLeft: undefined,
    })
  })
  it('410 ACCOUNT.CODE_EXPIRED (expired, used, exhausted, unknown id): restart', () => {
    expect(codeFailureOf(err('ACCOUNT.CODE_EXPIRED', 410))).toEqual({ kind: 'expired' })
  })
  it('429: wait', () => {
    expect(codeFailureOf(err('ACCOUNT.RATE_LIMITED', 429)).kind).toBe('rate-limited')
  })
  it('anything else is other (the generic message)', () => {
    expect(codeFailureOf(new Error('boom'))).toEqual({ kind: 'other' })
  })
})
