import { Badge, Button } from '@skeleton/ui'
import { useId } from 'react'
import {
  formatPrice,
  monthlyEquivalent,
  savingsPercent,
  type BillingInterval,
  type PricingPlan,
} from './pricing'
import styles from './PricingTable.module.css'

export type PricingLabels = {
  /** 월 · 연 토글 묶음의 이름 */
  interval: string
  monthly: string
  yearly: string
  /** 연 결제 버튼 옆의 절약 표시(`%`) */
  yearlySavings: (percent: number) => string
  /** 금액 뒤(`/ month`) */
  perMonth: string
  /** 연 결제일 때 총액 안내 */
  billedYearly: (total: string) => string
  /** 0원 요금제의 금액 자리 */
  free: string
  /** 맞춤 가격(`price: null`) 요금제의 금액 자리 */
  custom: string
  /** 강조 요금제의 말머리 */
  highlight: string
}

const DEFAULT_LABELS: PricingLabels = {
  interval: 'Billing period',
  monthly: 'Monthly',
  yearly: 'Yearly',
  yearlySavings: (percent) => `Save ${percent}%`,
  perMonth: '/ month',
  billedYearly: (total) => `Billed ${total} yearly`,
  free: 'Free',
  custom: 'Custom',
  highlight: 'Most popular',
}

export type PricingTableProps = {
  plans: PricingPlan[]
  interval: BillingInterval
  onIntervalChange: (interval: BillingInterval) => void
  /** 요금제의 행동 버튼 — 보통 가입 · 결제 · 문의로 이동 */
  onSelect: (plan: PricingPlan, interval: BillingInterval) => void
  /** ISO 4217(`USD` · `KRW`) */
  currency: string
  /** 금액 서식의 로케일(`en-US` · `ko-KR`) — 명시한다(서버 렌더와 같아야 한다) */
  locale: string
  title?: string
  subtitle?: string
  /** 제목 단계(기본 2) */
  headingLevel?: 2 | 3
  labels?: Partial<PricingLabels>
}

/**
 * 요금제 표 — 데이터(`plans`)로 그린다. 월 · 연 토글(연 결제는 한 달 값 + 연 총액 + 절약 %), 강조 요금제, 0원 · 맞춤 가격 요금제.
 * 값(`interval`)은 부모가 쥔다. 글자는 모두 prop(`labels`), 금액은 `Intl`(통화 · 로케일 명시).
 */
export function PricingTable({
  plans,
  interval,
  onIntervalChange,
  onSelect,
  currency,
  locale,
  title,
  subtitle,
  headingLevel = 2,
  labels: given,
}: PricingTableProps) {
  const labels = { ...DEFAULT_LABELS, ...given }
  const headingId = useId()
  const savings = savingsPercent(plans)
  const Heading = `h${headingLevel}` as const
  return (
    <section className={styles.root} aria-labelledby={title ? headingId : undefined}>
      {(title || subtitle) && (
        <header className={styles.header}>
          {title && <Heading id={headingId}>{title}</Heading>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </header>
      )}
      <div className={styles.toggle} role="group" aria-label={labels.interval}>
        {(['monthly', 'yearly'] as const).map((value) => (
          <Button
            key={value}
            variant={interval === value ? 'primary' : 'secondary'}
            aria-pressed={interval === value}
            onClick={() => onIntervalChange(value)}
          >
            {labels[value]}
            {value === 'yearly' && savings > 0 && (
              <span className={styles.savings}> · {labels.yearlySavings(savings)}</span>
            )}
          </Button>
        ))}
      </div>
      <ul className={styles.plans}>
        {plans.map((plan) => {
          const monthly = monthlyEquivalent(plan, interval)
          const free = plan.price !== null && plan.price.monthly === 0 && plan.price.yearly === 0
          return (
            <li key={plan.id} className={styles.item}>
              <article
                className={styles.plan}
                data-highlighted={plan.highlighted ? 'true' : undefined}
                aria-labelledby={`${headingId}-${plan.id}`}
              >
                <div className={styles.planHead}>
                  <h3 id={`${headingId}-${plan.id}`} className={styles.planName}>
                    {plan.name}
                  </h3>
                  {plan.highlighted && <Badge tone="info">{labels.highlight}</Badge>}
                </div>
                {plan.description && <p className={styles.description}>{plan.description}</p>}
                <p className={styles.price}>
                  {plan.price === null ? (
                    <span className={styles.amount}>{labels.custom}</span>
                  ) : free ? (
                    <span className={styles.amount}>{labels.free}</span>
                  ) : (
                    <>
                      <span className={styles.amount}>
                        {formatPrice(monthly!, currency, locale)}
                      </span>
                      <span className={styles.per}> {labels.perMonth}</span>
                    </>
                  )}
                </p>
                <p className={styles.note}>
                  {interval === 'yearly' && plan.price && !free
                    ? labels.billedYearly(formatPrice(plan.price.yearly, currency, locale))
                    : ' '}
                </p>
                <ul className={styles.features}>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <span aria-hidden="true" className={styles.check}>
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.highlighted ? 'primary' : 'secondary'}
                  onClick={() => onSelect(plan, interval)}
                >
                  {plan.ctaLabel}
                </Button>
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
