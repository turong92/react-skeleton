import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { withdrawFailureKeyOf } from './withdrawFailure'

const apiError = (code: string, status: number) =>
  new ApiRequestError({ code, title: 't', status, timestamp: 't' }, 'tr', 'sp', 'tp')

describe('withdrawFailureKeyOf — what to say when taking a refund request back did not work', () => {
  it('a decided request (409 not allowed, 404 not found) is not worth pressing again', () => {
    expect(withdrawFailureKeyOf(apiError('PAYMENT.REFUND_NOT_ALLOWED', 409))).toBe(
      'cheer.detail.withdrawDecided',
    )
    expect(withdrawFailureKeyOf(apiError('PAYMENT.REFUND_NOT_FOUND', 404))).toBe(
      'cheer.detail.withdrawDecided',
    )
  })

  it('an unknown result (network, 5xx) may be pressed again', () => {
    expect(withdrawFailureKeyOf(new Error('network'))).toBe('cheer.detail.withdrawFailed')
    expect(withdrawFailureKeyOf(apiError('COMMON.INTERNAL', 500))).toBe(
      'cheer.detail.withdrawFailed',
    )
  })
})
