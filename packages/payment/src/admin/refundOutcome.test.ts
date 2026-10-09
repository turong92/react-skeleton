import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { refund } from '../test/fixtures'
import {
  assertRefundDone,
  RefundNotDoneError,
  refundProblemOf,
  refundVerdictIsKnown,
} from './refundOutcome'

const answered = (status: number, code: string) =>
  new ApiRequestError({ code, title: 't', status, timestamp: 't', traceId: 'tr' }, 'tr', 'sp', 'tp')

describe('refundProblemOf - what a failed refund call tells us about the money', () => {
  it('a ledger answer is a verdict: the server looked at the request and said what happened', () => {
    expect(refundProblemOf(answered(402, 'PAYMENT.REFUND_DECLINED'))).toBe('declined')
    expect(refundProblemOf(answered(409, 'PAYMENT.REFUND_IN_PROGRESS'))).toBe('inProgress')
    expect(refundProblemOf(answered(409, 'PAYMENT.REFUND_NOT_ALLOWED'))).toBe('notAllowed')
    expect(refundProblemOf(answered(400, 'PAYMENT.REFUND_AMOUNT_EXCEEDED'))).toBe('amountExceeded')
    expect(refundProblemOf(answered(404, 'PAYMENT.ORDER_NOT_FOUND'))).toBe('otherConfirmed')
  })

  it('503 PAYMENT.UNAVAILABLE means the lookup before sending failed - nothing went out', () => {
    expect(refundProblemOf(answered(503, 'PAYMENT.UNAVAILABLE'))).toBe('unavailable')
  })

  it('a refund line that came back FAILED, REJECTED or WITHDRAWN is a verdict too', () => {
    for (const status of ['FAILED', 'REJECTED', 'WITHDRAWN'] as const)
      expect(refundProblemOf(new RefundNotDoneError(refund({ status })))).toBe('notDone')
  })

  it('only an answer that carries a ledger code (PAYMENT.*) is a verdict: a 4xx without one, and the provider-routing failures, are unknown', () => {
    for (const error of [
      answered(402, 'COMMON.PAYMENT_REQUIRED'),
      answered(404, 'COMMON.NOT_FOUND'),
      answered(409, 'COMMON.CONFLICT'),
      answered(409, 'PAYMENT.PROVIDER_NOT_FOUND'),
      answered(400, 'PAYMENT.ROUTING_FAILED'),
    ])
      expect(refundProblemOf(error), String(error.apiError.code)).toBe('unknown')
    // 같은 상태 코드라도 장부 코드가 붙으면 확정이다
    expect(refundProblemOf(answered(409, 'PAYMENT.REFUND_NOT_ALLOWED'))).toBe('notAllowed')
    expect(refundVerdictIsKnown(answered(409, 'COMMON.CONFLICT'))).toBe(false)
    expect(refundVerdictIsKnown(answered(404, 'PAYMENT.ORDER_NOT_FOUND'))).toBe(true)
  })

  it('a request the server refused before it claimed anything (amount 0 or negative, wrong type, broken JSON) is a verdict: COMMON.VALIDATION_FAILED, PARAMETER_VALIDATION_FAILED and MALFORMED_REQUEST mean nothing went out, so the key is let go and the field opens', () => {
    for (const code of [
      'COMMON.VALIDATION_FAILED',
      'COMMON.PARAMETER_VALIDATION_FAILED',
      'COMMON.MALFORMED_REQUEST',
    ]) {
      expect(refundProblemOf(answered(400, code)), code).toBe('invalid')
      expect(refundVerdictIsKnown(answered(400, code)), code).toBe(true)
    }
  })

  it('the boundary holds: other COMMON.* codes (429, 401, 403, 404, 409, 500 ...) and a 4xx with no code stay unknown - only those three are a verdict', () => {
    for (const [status, code] of [
      [429, 'COMMON.TOO_MANY_REQUESTS'],
      [401, 'COMMON.UNAUTHORIZED'],
      [403, 'COMMON.FORBIDDEN'],
      [404, 'COMMON.NOT_FOUND'],
      [409, 'COMMON.IDEMPOTENCY_ERROR'],
      [500, 'COMMON.INTERNAL_SERVER_ERROR'],
      [400, 'COMMON.SOMETHING_NEW'],
      [400, ''],
    ] as const)
      expect(refundProblemOf(answered(status, code)), `${status} ${code}`).toBe('unknown')
  })

  it('everything else does not tell us whether money moved: network, timeout, 5xx, 401/403/408/429, plain errors', () => {
    for (const error of [
      new TypeError('network'),
      answered(500, 'COMMON.INTERNAL'),
      answered(502, 'PAYMENT.PROVIDER_ERROR'),
      answered(503, 'COMMON.UNAVAILABLE'),
      answered(504, 'COMMON.TIMEOUT'),
      answered(401, 'AUTH.UNAUTHORIZED'),
      answered(403, 'COMMON.FORBIDDEN'),
      answered(408, 'COMMON.TIMEOUT'),
      answered(429, 'COMMON.TOO_MANY_REQUESTS'),
      'boom',
      undefined,
    ])
      expect(refundProblemOf(error), String(error)).toBe('unknown')
  })
})

describe('assertRefundDone - the line a refund call returns says what became of it', () => {
  it('SUCCEEDED (done) and PENDING (on its way) pass through untouched', () => {
    const done = refund({ status: 'SUCCEEDED' })
    const going = refund({ status: 'PENDING' })
    expect(assertRefundDone(done)).toBe(done)
    expect(assertRefundDone(going)).toBe(going)
  })

  it('a line that was already closed without refunding (the same key sent again) throws, carrying the line', () => {
    for (const status of ['FAILED', 'REJECTED', 'WITHDRAWN'] as const) {
      const line = refund({ status })
      try {
        assertRefundDone(line)
        expect.unreachable(status)
      } catch (error) {
        expect(error).toBeInstanceOf(RefundNotDoneError)
        expect((error as RefundNotDoneError).refund).toBe(line)
      }
    }
  })
})
