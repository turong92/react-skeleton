import { formatInstant } from '@skeleton/time'
import { Badge } from '@skeleton/ui'
import { useState } from 'react'
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
  /** 사용 시작 날짜 글자(기본 `10월 30일`) */
  formatDay?: (iso: string) => string
  /** 지금(ms) - 사용 시작이 이보다 뒤면 「○월 ○일부터」. 앱은 서버 시계를 준다(기기 시계가 틀려도 같은 판정). 안 주면 기기 시계 */
  now?: () => number
}

/** 쿠폰 한 장 — 이름, 혜택 한 줄, 기한, 최소 금액. 쓸 수 없는 것은 상태 알약. 눌리지 않는다 */
export function CouponCard({
  coupon,
  labels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  formatDay = (iso) =>
    new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(new Date(iso)),
  now,
}: CouponCardProps) {
  // 시계를 안 주면 처음 그릴 때 한 번 읽는다(렌더 안에서 기기 시계를 부르지 않는다)
  const [firstRender] = useState(() => Date.now())
  const at = now ? now() : firstRender
  const t = labels.coupon
  const usable = coupon.status === 'AVAILABLE'
  // 사용 시작 전이면 날짜를 말한다 - 결제 화면의 쿠폰 고르기에는 서버가 이미 빼 둔다
  const notYet = coupon.usableFrom != null && new Date(coupon.usableFrom).getTime() > at
  return (
    <article
      className={styles.card}
      data-status={coupon.status}
      data-not-yet={notYet ? 'true' : undefined}
    >
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
        {notYet && coupon.usableFrom != null && `${t.usableFrom(formatDay(coupon.usableFrom))} · `}
        {coupon.expiresAt ? t.expiresAt(formatTime(coupon.expiresAt)) : t.noExpiry}
        {coupon.minAmount !== null &&
          ` · ${t.minAmount(formatMoney(coupon.minAmount, coupon.currency, { locale, currencySuffix: t.currencySuffix }))}`}
      </p>
    </article>
  )
}
