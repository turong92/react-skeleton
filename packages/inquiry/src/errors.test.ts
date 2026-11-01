import { ApiRequestError, type ApiError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { inquiryProblem } from './errors'

const failure = (code: string, status: number) =>
  new ApiRequestError(
    { code, title: code, status, timestamp: '2026-11-01T00:00:00Z' } satisfies ApiError,
    'trace',
    'span',
    'traceparent',
  )

describe('inquiryProblem', () => {
  it('names the three failures the form explains', () => {
    expect(inquiryProblem(failure('INQUIRY.INVALID', 400))).toBe('invalid')
    expect(inquiryProblem(failure('INQUIRY.CAPTCHA_FAILED', 400))).toBe('captcha')
    expect(inquiryProblem(failure('INQUIRY.TOO_MANY', 429))).toBe('tooMany')
  })

  it('leaves everything else to the generic sentence', () => {
    expect(inquiryProblem(failure('COMMON.FORBIDDEN', 403))).toBe('other')
    expect(inquiryProblem(new Error('boom'))).toBe('other')
  })
})
