import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '@skeleton/api-client'
import {
  DISPLAY_NAME_MAX_LENGTH,
  displayNameFieldError,
  displayNameProblem,
  resolveDisplayNameMode,
} from './displayName'
import { defaultAuthLabels as L } from './labels'

describe('resolveDisplayNameMode', () => {
  it('keeps the old askDisplayName boolean working and lets the new prop win', () => {
    expect(resolveDisplayNameMode(undefined, undefined)).toBe('off')
    expect(resolveDisplayNameMode(undefined, true)).toBe('optional')
    expect(resolveDisplayNameMode('required', false)).toBe('required')
    expect(resolveDisplayNameMode('off', true)).toBe('off')
  })
})

describe('displayNameProblem', () => {
  it('only a required nickname can be missing, and blanks count as missing', () => {
    expect(displayNameProblem('', 'required', L)).toBe(L.problemDisplayNameMissing)
    expect(displayNameProblem('   ', 'required', L)).toBe(L.problemDisplayNameMissing)
    expect(displayNameProblem('', 'optional', L)).toBeUndefined()
    expect(displayNameProblem('', 'off', L)).toBeUndefined()
  })

  it('allows 1..60 characters after trimming', () => {
    expect(displayNameProblem(`  ${'a'.repeat(60)}  `, 'optional', L)).toBeUndefined()
    expect(displayNameProblem('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1), 'optional', L)).toBe(
      L.problemDisplayNameTooLong(DISPLAY_NAME_MAX_LENGTH),
    )
  })
})

describe('nickname rules the client can check right away', () => {
  it('# and @ are refused at once, with the same sentence the server field error gets', () => {
    expect(displayNameProblem('수#민', 'optional', L)).toBe(L.problemDisplayNamePattern)
    expect(displayNameProblem('@수민', 'optional', L)).toBe(L.problemDisplayNamePattern)
  })

  it('the length counts code points: a ZWJ emoji sequence is fine, 60 of them are 60 code points at most', () => {
    expect(displayNameProblem('👩‍💻 코딩', 'required', L)).toBeUndefined()
    expect(displayNameProblem('😀'.repeat(60), 'optional', L)).toBeUndefined() // UTF-16 으로는 120 이지만 코드 포인트는 60
    expect(displayNameProblem('😀'.repeat(61), 'optional', L)).toBe(L.problemDisplayNameTooLong(60))
  })
})

describe('displayNameFieldError — the server field error becomes our sentence, never its English message', () => {
  const fieldError = (code: string) =>
    new ApiRequestError(
      {
        code: 'COMMON.VALIDATION_FAILED',
        title: 'v',
        status: 400,
        timestamp: 't',
        errors: [{ field: 'displayName', code, message: 'English from the server' }],
      } as never,
      'trace',
      'span',
      'tp',
    )
  it.each([
    ['Required', L.problemDisplayNameMissing],
    ['Size', L.problemDisplayNameTooLong(60)],
    ['Pattern', L.problemDisplayNamePattern],
    ['Reserved', L.problemDisplayNameReserved],
  ])('%s', (code, text) => {
    expect(displayNameFieldError(fieldError(code), L)).toBe(text)
  })

  it('is undefined for other errors and other fields', () => {
    expect(displayNameFieldError(new Error('x'), L)).toBeUndefined()
  })
})
