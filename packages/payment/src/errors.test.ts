import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import {
  confirmOutcomeOf,
  declineDetail,
  isPaymentError,
  isPaymentLedgerError,
  PAYMENT_ERROR_CODES,
  PAYMENT_LEDGER_ERROR_CODES,
  PaymentLedgerErrorCodes,
} from './errors'

const failure = (code: string, data?: unknown) =>
  new ApiRequestError({ code, title: 't', status: 400, timestamp: 't', data }, 'tr', 'sp', 'tp')

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

describe('ledger error codes (HTTP contract, the list of user and operator errors)', () => {
  it('lists the twenty the backend adds, under the PAYMENT. prefix', () => {
    expect([...PAYMENT_LEDGER_ERROR_CODES].sort()).toEqual(
      [
        'ORDER_NOT_FOUND',
        'REFUND_NOT_FOUND',
        'ITEM_NOT_PURCHASABLE',
        'IDEMPOTENCY_CONFLICT',
        'AMOUNT_MISMATCH',
        'ORDER_NOT_PAYABLE',
        'MODE_MISMATCH',
        'DECLINED',
        'REFUND_NOT_ALLOWED',
        'REFUND_IN_PROGRESS',
        'REFUND_AMOUNT_EXCEEDED',
        'REFUND_DECLINED',
        'CAPABILITY_UNSUPPORTED',
        'UNAVAILABLE',
        'WEBHOOK_EVENT_NOT_FOUND',
        'PROVIDER_PAYMENT_NOT_FOUND',
        'SUBSCRIPTION_NOT_FOUND',
        'ALREADY_SUBSCRIBED',
        'SUBSCRIPTION_NOT_ACTIVATABLE',
        'SUBSCRIPTION_NOT_CANCELABLE',
      ]
        .map((name) => `PAYMENT.${name}`)
        .sort(),
    )
    expect(PaymentLedgerErrorCodes.DECLINED).toBe('PAYMENT.DECLINED')
    expect(PaymentLedgerErrorCodes.ORDER_NOT_FOUND).toBe('PAYMENT.ORDER_NOT_FOUND')
  })

  it('isPaymentLedgerError matches them (one code or any), and isPaymentError keeps its old meaning', () => {
    expect(isPaymentLedgerError(failure('PAYMENT.DECLINED'))).toBe(true)
    expect(isPaymentLedgerError(failure('PAYMENT.DECLINED'), 'PAYMENT.DECLINED')).toBe(true)
    expect(isPaymentLedgerError(failure('PAYMENT.DECLINED'), 'PAYMENT.AMOUNT_MISMATCH')).toBe(false)
    expect(isPaymentLedgerError(failure('PAYMENT.PROVIDER_ERROR'))).toBe(false)
    expect(isPaymentLedgerError(new Error('PAYMENT.DECLINED'))).toBe(false)
    expect(isPaymentError(failure('PAYMENT.DECLINED'))).toBe(false)
  })

  it('declineDetail reads data.providerCode and data.category of a DECLINED / REFUND_DECLINED error only', () => {
    expect(
      declineDetail(
        failure('PAYMENT.DECLINED', { providerCode: 'REJECT_CARD', category: 'ISSUER' }),
      ),
    ).toEqual({ providerCode: 'REJECT_CARD', category: 'ISSUER' })
    expect(declineDetail(failure('PAYMENT.REFUND_DECLINED', { providerCode: 'X' }))).toEqual({
      providerCode: 'X',
    })
    expect(declineDetail(failure('PAYMENT.DECLINED'))).toEqual({})
    expect(declineDetail(failure('PAYMENT.DECLINED', { providerCode: 5, category: {} }))).toEqual(
      {},
    )
    expect(declineDetail(failure('PAYMENT.AMOUNT_MISMATCH', { providerCode: 'X' }))).toBeNull()
    expect(declineDetail(new Error('x'))).toBeNull()
  })
})

describe('confirmOutcomeOf — what a failed confirm call tells us about the payment', () => {
  const answered = (status: number, code: string) =>
    new ApiRequestError({ code, title: 't', status, timestamp: 't' }, 'tr', 'sp', 'tp')

  it('402 DECLINED is a confirmed refusal', () => {
    expect(confirmOutcomeOf(answered(402, 'PAYMENT.DECLINED'))).toBe('declined')
  })

  it.each([
    [400, 'PAYMENT.AMOUNT_MISMATCH'],
    [409, 'PAYMENT.MODE_MISMATCH'],
    [409, 'PAYMENT.ORDER_NOT_PAYABLE'],
    [404, 'PAYMENT.ORDER_NOT_FOUND'],
  ])('%i %s is a confirmed "no" that is not a card refusal: rejected', (status, code) => {
    expect(confirmOutcomeOf(answered(status, code))).toBe('rejected')
  })

  it.each([
    ['a network error / timeout (status 0)', answered(0, 'CLIENT.NETWORK_ERROR')],
    ['a plain Error', new Error('boom')],
    ['a 502', answered(502, 'PAYMENT.PROVIDER_ERROR')],
    ['a 503', answered(503, 'PAYMENT.UNAVAILABLE')],
    ['a 500', answered(500, 'COMMON.INTERNAL')],
    ['a 401 the session could not renew', answered(401, 'AUTH.UNAUTHORIZED')],
    ['a 403 from a gate', answered(403, 'ACCOUNT.EMAIL_REQUIRED')],
    ['a 408', answered(408, 'COMMON.TIMEOUT')],
    ['a 429', answered(429, 'COMMON.TOO_MANY_REQUESTS')],
    ['a 402 that is not a card refusal', answered(402, 'COMMON.PAYWALL')],
    ['nothing at all', undefined],
  ])('%s leaves the result unknown', (_name, error) => {
    expect(confirmOutcomeOf(error)).toBe('unknown')
  })
})
