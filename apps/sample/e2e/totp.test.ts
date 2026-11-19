import { describe, expect, it } from 'vitest'
import { nextStep, STEP_MS, stepOf, totpAt } from './totp'

// RFC 6238 부록 B(SHA1) - 비밀 "12345678901234567890" 의 base32. 표는 8자리라 끝 6자리를 본다
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('totpAt (the e2e authenticator app)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ])('matches the RFC 6238 SHA1 vector at T=%i', (seconds, code) => {
    expect(totpAt(RFC_SECRET, stepOf(seconds * 1000))).toBe(code)
  })

  it('accepts a lower-case secret with spaces, the way an app shows it', () => {
    expect(totpAt('gezd gnbv gy3t qojq gezd gnbv gy3t qojq', 1)).toBe('287082')
  })
})

describe('nextStep (a code is never used twice, and never more than one step ahead)', () => {
  const now = 10 * STEP_MS + 5_000 // 걸음 10 의 한가운데

  it('uses the current step when nothing was used yet or the last one is older', () => {
    expect(nextStep(-1, now)).toEqual({ step: 10, waitMs: 0 })
    expect(nextStep(7, now)).toEqual({ step: 10, waitMs: 0 })
  })

  it('moves on to the step after the last one used, which the server still accepts (one ahead)', () => {
    expect(nextStep(10, now)).toEqual({ step: 11, waitMs: 0 })
  })

  it('waits for the step before the one it needs when that would be two or more ahead', () => {
    expect(nextStep(11, now)).toEqual({ step: 12, waitMs: 11 * STEP_MS - now })
  })
})
