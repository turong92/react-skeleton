import { Button, Card, EmptyState } from '@skeleton/ui'
import { priceEveryDisplay } from './format'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { SubscriptionPlan } from './subscriptionTypes'
import styles from './SubscriptionPlanList.module.css'

export type SubscriptionPlanListProps = {
  plans: readonly SubscriptionPlan[]
  /** 「구독하기」를 눌렀을 때. 카드 등록 창을 여는 것은 부모 */
  onSubscribe: (plan: SubscriptionPlan) => void
  /** 카드 등록 창을 여는 중인 플랜 코드 — 그 카드의 단추에 스피너가 돌고 다른 단추는 잠긴다 */
  busyPlanCode?: string | null
  locale?: string
  labels?: PaymentLabelsInput
}

/**
 * 구독 플랜 카드 목록 — 카드마다 이름 · 「3,900원 / 월」 · 채운 「구독하기」 단추 하나. 이름은 서버가 준 `name` 그대로
 * (앱이 번역하려면 `plans` 의 `name` 을 바꿔 넘긴다). 375 · 320px 에서는 한 줄에 한 장으로 접힌다.
 */
export function SubscriptionPlanList({
  plans,
  onSubscribe,
  busyPlanCode = null,
  locale,
  labels: input,
}: SubscriptionPlanListProps) {
  const labels = resolvePaymentLabels(input)
  if (plans.length === 0)
    return (
      <EmptyState
        headingLevel={2}
        title={labels.subscription.plans.emptyTitle}
        description={labels.subscription.plans.emptyDescription}
      />
    )
  return (
    <ul className={styles.list} aria-label={labels.subscription.plans.caption}>
      {plans.map((plan) => (
        <li key={plan.code}>
          <Card title={plan.name}>
            <div className={styles.body}>
              <p className={styles.price}>
                {priceEveryDisplay(plan.amount, plan.period, labels, locale)}
              </p>
              <Button
                variant="primary"
                loading={busyPlanCode === plan.code}
                loadingLabel={labels.subscription.plans.subscribing}
                disabled={busyPlanCode !== null && busyPlanCode !== plan.code}
                aria-label={labels.subscription.plans.subscribeFor(plan.name)}
                onClick={() => onSubscribe(plan)}
              >
                {labels.subscription.plans.subscribe}
              </Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}
