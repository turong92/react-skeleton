import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { isPaymentError, PAYMENT_ERROR_CODES } from './errors'

const failure = (code: string) =>
  new ApiRequestError({ code, title: 't', status: 400, timestamp: 't' }, 'tr', 'sp', 'tp')

describe('payment error codes (modules/payment PaymentErrorCode)', () => {
  it('lists the three the backend defines', () => {
    expect(PAYMENT_ERROR_CODES).toEqual([
      'PAYMENT.PROVIDER_NOT_FOUND',
      'PAYMENT.ROUTING_FAILED',
      'PAYMENT.PROVIDER_ERROR',
    ])
  })

  it('isPaymentError is true for those codes only', () => {
    expect(isPaymentError(failure('PAYMENT.PROVIDER_ERROR'))).toBe(true)
    expect(isPaymentError(failure('PAYMENT.ROUTING_FAILED'))).toBe(true)
    expect(isPaymentError(failure('COMMON.NOT_FOUND'))).toBe(false)
    expect(isPaymentError(new Error('PAYMENT.PROVIDER_ERROR'))).toBe(false)
  })
})
