import { Button, Card, EmptyState } from '@skeleton/ui'
import { useState, type ReactNode } from 'react'
import { formatMoney, formatSaleDate, periodUnitText, priceEveryDisplay } from './format'
import { resolvePaymentLabels, type PaymentLabels, type PaymentLabelsInput } from './labels'
import { groupPlans, regularAmountOf, type PlanGroup } from './planGroups'
import type { SubscriptionPlan } from './subscriptionTypes'
import styles from './SubscriptionPlanList.module.css'

export type SubscriptionPlanListProps = {
  plans: readonly SubscriptionPlan[]
  /** 「구독하기」를 눌렀을 때. 카드 등록 창을 여는 것은 부모 */
  onSubscribe: (plan: SubscriptionPlan) => void
  /** 카드 등록 창을 여는 중인 플랜 코드 — 그 카드의 단추에 스피너가 돌고 다른 단추는 잠긴다 */
  busyPlanCode?: string | null
  locale?: string
  /** 카드의 금액 자리를 앱이 채운다(예: Paddle 이 돌려준 구매자 통화 금액 · 불러오는 중 · 안내). `undefined` 를 돌려주면 서버가 준 표의 금액 */
  priceOf?: (plan: SubscriptionPlan) => ReactNode
  /** 행사가가 끝나는 때(ISO-8601)를 플랜 코드로 — 있으면 취소선 정가 옆에 「11월 30일까지」를 쓴다 */
  saleEndsAtOf?: (plan: SubscriptionPlan) => string | null | undefined
  /** 행사 끝 날짜를 읽는 IANA 시간대(기본 `UTC`) */
  timeZone?: string
  labels?: PaymentLabelsInput
}

/** 주기 단추의 글자 - 한 달 · 한 해는 낱말, 그 밖은 주기 글자(「3개월」) */
function intervalName(period: string, labels: PaymentLabels): string {
  if (period === 'P1M') return labels.subscription.plans.monthly
  if (period === 'P1Y') return labels.subscription.plans.yearly
  return periodUnitText(period, labels) ?? period
}

type CardProps = Omit<SubscriptionPlanListProps, 'plans' | 'labels'> & {
  group: PlanGroup
  labels: PaymentLabels
}

function PlanCard({
  group,
  onSubscribe,
  busyPlanCode = null,
  locale,
  priceOf,
  saleEndsAtOf,
  timeZone,
  labels,
}: CardProps) {
  const [pickedCode, setPickedCode] = useState(group.plans[0]!.code)
  const plan = group.plans.find((p) => p.code === pickedCode) ?? group.plans[0]!
  const regular = regularAmountOf(plan)
  const saleEnd = regular ? saleEndsAtOf?.(plan) : null
  const busy = busyPlanCode === plan.code
  return (
    <Card title={plan.name}>
      <div className={styles.body}>
        {group.plans.length > 1 && (
          <div
            className={styles.intervals}
            role="group"
            aria-label={labels.subscription.plans.intervalCaption}
          >
            {group.plans.map((option) => (
              <Button
                key={option.code}
                variant={option.code === plan.code ? 'primary' : 'secondary'}
                aria-pressed={option.code === plan.code}
                disabled={busyPlanCode !== null}
                onClick={() => setPickedCode(option.code)}
              >
                {intervalName(option.period, labels)}
              </Button>
            ))}
          </div>
        )}
        <p className={styles.price}>
          {regular && (
            <del className={styles.regular}>
              {formatMoney(regular, { locale, currencySuffix: labels.currencySuffix })}
            </del>
          )}
          {priceOf?.(plan) ?? priceEveryDisplay(plan.amount, plan.period, labels, locale)}
        </p>
        {saleEnd && (
          <p className={styles.sale}>
            {labels.subscription.plans.saleUntil(formatSaleDate(saleEnd, locale, timeZone))}
          </p>
        )}
        <Button
          variant="primary"
          loading={busy}
          loadingLabel={labels.subscription.plans.subscribing}
          disabled={busyPlanCode !== null && !busy}
          aria-label={labels.subscription.plans.subscribeFor(plan.name)}
          onClick={() => onSubscribe(plan)}
        >
          {labels.subscription.plans.subscribe}
        </Button>
      </div>
    </Card>
  )
}

/**
 * 구독 플랜 카드 목록 — 상품(`productCode`)마다 카드 한 장: 이름 · 「3,900원 · 1개월마다 결제」 · 채운 「구독하기」 단추 하나.
 * 한 상품에 주기가 둘 이상(월 · 연)이면 카드 안에 주기 단추(누른 것이 채워진다)가 생기고, 행사 중이면(`regularAmount`) 정가에 취소선.
 * `productCode` 가 없는 플랜(옛 서버)은 플랜 하나가 카드 하나. 이름은 서버가 준 `name` 그대로(앱이 번역하려면 `plans` 의 `name` 을 바꿔 넘긴다).
 * 375 · 320px 에서는 한 줄에 한 장으로 접힌다.
 */
export function SubscriptionPlanList({ plans, labels: input, ...rest }: SubscriptionPlanListProps) {
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
      {groupPlans(plans).map((group) => (
        <li key={group.key}>
          <PlanCard group={group} labels={labels} {...rest} />
        </li>
      ))}
    </ul>
  )
}
