import { describe, expect, it } from 'vitest'
import { policyLinesOf } from './countryPolicy'

describe('policyLinesOf', () => {
  it('Korean policy: full refund inside the withdrawal days if unused, cancel any time with the penalty from the server', () => {
    expect(policyLinesOf({ key: 'korea', penaltyPercent: 10, withdrawalDays: 7 }, 'toss')).toEqual([
      { key: 'payment.policy.korea.withdrawal', values: { days: 7 } },
      { key: 'payment.policy.korea.cancel', values: { percent: 10 } },
    ])
  })

  it('any other country on Paddle: Paddle handles the payment, cancel at the period end, refunds are reviewed by Paddle', () => {
    expect(policyLinesOf({ key: 'period-end-only' }, 'paddle').map((line) => line.key)).toEqual([
      'payment.policy.paddle.payment',
      'payment.policy.periodEnd',
      'payment.policy.paddle.refund',
    ])
  })

  it('a policy without a provider note still says when a cancel takes effect', () => {
    expect(policyLinesOf({ key: 'period-end-only' }, 'toss').map((line) => line.key)).toEqual([
      'payment.policy.periodEnd',
    ])
    expect(policyLinesOf(undefined, 'paddle')).toEqual([])
  })
})
