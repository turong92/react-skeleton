import { describe, expect, it } from 'vitest'
import { inquiryFieldProblems } from './validation'

describe('inquiryFieldProblems', () => {
  it('counts the body without surrounding spaces: 10 to 2000 characters', () => {
    expect(
      inquiryFieldProblems({ body: ' '.repeat(5) + 'a'.repeat(9) + ' ', email: '' }).body,
    ).toBe('length')
    expect(inquiryFieldProblems({ body: 'a'.repeat(10), email: '' }).body).toBeUndefined()
    expect(inquiryFieldProblems({ body: 'a'.repeat(2000), email: '' }).body).toBeUndefined()
    expect(inquiryFieldProblems({ body: 'a'.repeat(2001), email: '' }).body).toBe('length')
  })

  it('accepts an empty email (no reply wanted) and refuses a malformed one', () => {
    const body = 'a'.repeat(10)
    expect(inquiryFieldProblems({ body, email: '  ' }).email).toBeUndefined()
    expect(inquiryFieldProblems({ body, email: 'me@example.com' }).email).toBeUndefined()
    expect(inquiryFieldProblems({ body, email: 'me@example' }).email).toBe('format')
    expect(inquiryFieldProblems({ body, email: 'a'.repeat(250) + '@b.co' }).email).toBe('format')
  })
})
