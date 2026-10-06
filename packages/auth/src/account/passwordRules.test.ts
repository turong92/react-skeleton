import { describe, expect, it } from 'vitest'
import { passwordRequirements, passwordStrength, violationsOf } from './passwordRules'
import { ApiRequestError } from '@skeleton/api-client'

const policy = {
  minLength: 10,
  maxBytes: 72,
  requireLetter: true,
  requireDigit: true,
  requireSymbol: false,
  forbidEmailLocalPart: true,
}

describe('passwordRequirements (the same rules the backend PasswordPolicy applies)', () => {
  it('lists only the rules the policy switches on, each met or not', () => {
    const list = passwordRequirements(policy, 'abc')
    expect(list.map((r) => r.code)).toEqual([
      'TOO_SHORT',
      'NEEDS_LETTER',
      'NEEDS_DIGIT',
      'CONTAINS_EMAIL',
      'TOO_LONG',
    ])
    expect(list.find((r) => r.code === 'TOO_SHORT')?.met).toBe(false)
    expect(list.find((r) => r.code === 'NEEDS_LETTER')?.met).toBe(true)
    expect(list.find((r) => r.code === 'NEEDS_DIGIT')?.met).toBe(false)
  })

  it('counts length in characters but the maximum in UTF-8 bytes (like the server)', () => {
    const korean = '가'.repeat(25) + 'a1' // 27 chars, 77 bytes
    const list = passwordRequirements(policy, korean)
    expect(list.find((r) => r.code === 'TOO_SHORT')?.met).toBe(true)
    expect(list.find((r) => r.code === 'TOO_LONG')?.met).toBe(false)
  })

  it('flags the email local part when the email is known (>= 3 chars like the server)', () => {
    expect(
      passwordRequirements(policy, 'hunter2-sumin', 'sumin@example.com').find(
        (r) => r.code === 'CONTAINS_EMAIL',
      )?.met,
    ).toBe(false)
    expect(
      passwordRequirements(policy, 'hunter2-sumin', 'su@example.com').find(
        (r) => r.code === 'CONTAINS_EMAIL',
      )?.met,
    ).toBe(true)
  })

  it('requireSymbol appears only when switched on', () => {
    expect(
      passwordRequirements({ ...policy, requireSymbol: true }, 'abc').map((r) => r.code),
    ).toContain('NEEDS_SYMBOL')
  })

  it('an empty password meets nothing it requires', () => {
    expect(
      passwordRequirements(policy, '')
        .filter((r) => r.met)
        .map((r) => r.code),
    ).not.toContain('TOO_SHORT')
  })
})

describe('passwordStrength', () => {
  it('is 0 for empty, grows with length and variety, capped at 4', () => {
    expect(passwordStrength('', policy)).toBe(0)
    expect(passwordStrength('abc', policy)).toBe(1)
    expect(passwordStrength('abcdefghij', policy)).toBeLessThan(
      passwordStrength('abcdefghij1A!', policy),
    )
    expect(passwordStrength('Correct-Horse-Battery-9', policy)).toBe(4)
  })
  it('never rates a password below the policy minimum above 2', () => {
    expect(passwordStrength('Aa1!', policy)).toBeLessThanOrEqual(2)
  })
})

describe('violationsOf', () => {
  const policyError = (violations: unknown) =>
    new ApiRequestError(
      {
        code: 'ACCOUNT.PASSWORD_POLICY',
        title: 't',
        status: 400,
        timestamp: 't',
        data: { violations },
      },
      't',
      's',
      'p',
    )
  it('reads data.violations of ACCOUNT.PASSWORD_POLICY', () => {
    expect(violationsOf(policyError(['TOO_SHORT', 'BREACHED']))).toEqual(['TOO_SHORT', 'BREACHED'])
  })
  it('is empty for other errors or malformed data', () => {
    expect(violationsOf(new Error('x'))).toEqual([])
    expect(violationsOf(policyError('nope'))).toEqual([])
  })
})
