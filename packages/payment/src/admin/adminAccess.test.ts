import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { adminAccessProblem } from './adminAccess'

const failed = (status: number, code: string) =>
  new ApiRequestError({ code, title: 't', status, timestamp: 't', traceId: 'tr' }, 'tr', 'sp', 'tp')

describe('adminAccessProblem', () => {
  it('403 is a permission problem (the operator route answers it for anyone who is not an active admin)', () => {
    expect(adminAccessProblem(failed(403, 'COMMON.FORBIDDEN'))).toBe('forbidden')
  })

  it('a 404 that is not about one payment or refund means the operator routes are switched off', () => {
    expect(adminAccessProblem(failed(404, 'COMMON.NOT_FOUND'))).toBe('disabled')
    expect(adminAccessProblem(failed(404, 'CLIENT.HTTP_ERROR'))).toBe('disabled')
  })

  it('a 404 about one payment, refund or inbox line is just that: not found (not a switched-off route)', () => {
    expect(adminAccessProblem(failed(404, 'PAYMENT.ORDER_NOT_FOUND'))).toBeNull()
    expect(adminAccessProblem(failed(404, 'PAYMENT.REFUND_NOT_FOUND'))).toBeNull()
    expect(adminAccessProblem(failed(404, 'PAYMENT.WEBHOOK_EVENT_NOT_FOUND'))).toBeNull()
  })

  it('a 404 saying the provider does not know that payment (the "match with the provider" call) is just that - the routes are on', () => {
    expect(adminAccessProblem(failed(404, 'PAYMENT.PROVIDER_PAYMENT_NOT_FOUND'))).toBeNull()
  })

  it('anything else, and things that are not API errors, are not an access problem', () => {
    expect(adminAccessProblem(failed(500, 'COMMON.INTERNAL'))).toBeNull()
    expect(adminAccessProblem(failed(402, 'PAYMENT.REFUND_DECLINED'))).toBeNull()
    expect(adminAccessProblem(new Error('boom'))).toBeNull()
    expect(adminAccessProblem(undefined)).toBeNull()
  })
})
