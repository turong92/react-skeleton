import type { PaymentCancelPolicy } from '@skeleton/payment'
import type { MessageKey } from '../i18n'

export type PolicyLine = { key: MessageKey; values?: Record<string, number> }

/**
 * 그 나라의 해지·환불 규칙 요약(두세 줄). 나라 · 결제사 · 정책은 서버가 정해 `GET /config` 로 준다 - 화면은 고르지 않고 문구만 정한다.
 * 한국 정책이면 서버가 준 숫자(위약금 %, 철회 일수)를 그대로 쓴다.
 */
export function policyLinesOf(
  policy: PaymentCancelPolicy | null | undefined,
  provider: string | null | undefined,
): PolicyLine[] {
  if (!policy) return []
  if (policy.key === 'korea') {
    return [
      { key: 'payment.policy.korea.withdrawal', values: { days: policy.withdrawalDays ?? 0 } },
      { key: 'payment.policy.korea.cancel', values: { percent: policy.penaltyPercent ?? 0 } },
    ]
  }
  if (provider === 'paddle') {
    return [
      { key: 'payment.policy.paddle.payment' },
      { key: 'payment.policy.periodEnd' },
      { key: 'payment.policy.paddle.refund' },
    ]
  }
  return [{ key: 'payment.policy.periodEnd' }]
}
