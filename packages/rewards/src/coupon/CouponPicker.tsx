import { ChoiceGroup } from '@skeleton/ui'
import { formatMoney } from '../format'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import type { Coupon, QuotePreview } from '../types'
import { stageSummary } from './stageSummary'
import styles from './CouponPicker.module.css'

export type CouponPickerProps = {
  /** 이 결제에 쓸 수 있는 쿠폰(앱이 고른다 — 보통 `useCoupons(api, 'AVAILABLE')` 에서 대상에 맞는 것) */
  coupons: readonly Coupon[]
  /** 고른 쿠폰 id, 안 쓰면 null */
  selectedId: string | null
  onSelect: (couponId: string | null) => void
  /** 견적 결과 — 있으면 고른 쿠폰의 할인 전 · 후 금액을 보인다(결제 견적 응답에서 앱이 옮겨 준다) */
  preview?: QuotePreview
  /** 할인 전 금액 — 최소 결제 금액 안내용(없으면 `preview.originalAmount`) */
  orderAmount?: number
  labels?: RewardsLabels
  locale?: string
}

const NONE = ''

/** 결제 때 쿠폰 고르기 — 「쿠폰 쓰지 않기」 + 쿠폰마다 이름 · 혜택 한 줄, 아래에 할인 전 → 후 금액. 결제 패키지를 import 하지 않는다(앱이 잇는다) */
export function CouponPicker({
  coupons,
  selectedId,
  onSelect,
  preview,
  orderAmount,
  labels = defaultRewardsLabels,
  locale,
}: CouponPickerProps) {
  const t = labels.coupon
  const base = orderAmount ?? preview?.originalAmount
  const money = (amount: number, currency: string | null) =>
    formatMoney(amount, currency, { locale, currencySuffix: t.currencySuffix })

  const options = [
    { value: NONE, label: t.picker.none },
    ...coupons.map((coupon) => ({
      value: coupon.id,
      label: (
        <span className={styles.option}>
          <strong>{coupon.name}</strong>
          <span>{stageSummary(coupon.stages, t, { currency: coupon.currency, locale })}</span>
          {coupon.minAmount !== null && base !== undefined && base < coupon.minAmount && (
            <span className={styles.warn}>
              {t.picker.belowMinimum(money(coupon.minAmount, coupon.currency))}
            </span>
          )}
        </span>
      ),
    })),
  ]
  return (
    <div className={styles.picker}>
      <ChoiceGroup
        aria-label={t.picker.legend}
        options={options}
        value={selectedId ?? NONE}
        onChange={(value) => onSelect(value === NONE ? null : value)}
      />
      {selectedId !== null && preview && (
        <dl className={styles.preview}>
          <dt>{t.picker.originalPrice}</dt>
          <dd className={preview.amount !== preview.originalAmount ? styles.struck : undefined}>
            {money(preview.originalAmount, preview.currency)}
          </dd>
          <dt>{t.picker.finalPrice}</dt>
          <dd className={styles.final}>{money(preview.amount, preview.currency)}</dd>
        </dl>
      )}
    </div>
  )
}
