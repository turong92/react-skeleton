import { Badge, type BadgeProps } from '@skeleton/ui'
import { lookup } from './format'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { SubscriptionStatus } from './subscriptionTypes'

type Tone = NonNullable<BadgeProps['tone']>

const TONE: Record<SubscriptionStatus, Tone> = {
  PENDING: 'info',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  CANCELING: 'warning',
  ENDED: 'neutral',
}

export type SubscriptionStatusBadgeProps = {
  status: SubscriptionStatus
  labels?: PaymentLabelsInput
}

/** 구독 상태 알약 — 눌리지 않는다. 뜻은 글자로 전하고 색은 거든다. 모르는 상태는 코드를 그리지 않고 「확인 필요」 */
export function SubscriptionStatusBadge({ status, labels: input }: SubscriptionStatusBadgeProps) {
  const labels = resolvePaymentLabels(input)
  return (
    <Badge tone={lookup(TONE, status) ?? 'neutral'}>
      {lookup(labels.subscription.status, status) ?? labels.unknownStatus}
    </Badge>
  )
}
