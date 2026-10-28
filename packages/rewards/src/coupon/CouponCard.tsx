import { formatInstant } from '@skeleton/time'
import { Badge } from '@skeleton/ui'
import { formatMoney } from '../format'
import type { RewardsLabels } from '../labels'
import type { Coupon } from '../types'
import { stageSummary } from './stageSummary'
import styles from './CouponCard.module.css'

export type CouponCardProps = {
  coupon: Coupon
  labels: RewardsLabels
  locale?: string
  formatTime?: (iso: string) => string
}

/** 쿠폰 한 장 — 이름, 혜택 한 줄, 기한, 최소 금액. 쓸 수 없는 것은 상태 알약. 눌리지 않는다 */
export function CouponCard({
  coupon,
  labels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: CouponCardProps) {
  const t = labels.coupon
  const usable = coupon.status === 'AVAILABLE'
  return (
    <article className={styles.card} data-status={coupon.status}>
      <div className={styles.head}>
        <strong className={styles.name}>{coupon.name}</strong>
        {!usable && (
          <Badge tone={coupon.status === 'RESERVED' ? 'info' : 'neutral'}>
            {t.status[coupon.status]}
          </Badge>
        )}
      </div>
      <p className={styles.benefit}>
        {stageSummary(coupon.stages, t, { currency: coupon.currency, locale })}
      </p>
      <p className={styles.meta}>
        {coupon.expiresAt ? t.expiresAt(formatTime(coupon.expiresAt)) : t.noExpiry}
        {coupon.minAmount !== null &&
          ` · ${t.minAmount(formatMoney(coupon.minAmount, coupon.currency, { locale, currencySuffix: t.currencySuffix }))}`}
      </p>
    </article>
  )
}
