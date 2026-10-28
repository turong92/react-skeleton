import { Alert, Button, EmptyState, Skeleton, Tabs } from '@skeleton/ui'
import { useState } from 'react'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import type { CouponTab } from '../types'
import { CouponCard } from './CouponCard'
import type { CouponApi } from './couponApi'
import { useCoupons } from './queries'
import { RedeemCodeForm } from './RedeemCodeForm'
import styles from './CouponWallet.module.css'

export type CouponWalletProps = {
  api: Pick<CouponApi, 'listCoupons' | 'redeemCoupon'>
  labels?: RewardsLabels
  locale?: string
  formatTime?: (iso: string) => string
}

function CouponList({
  api,
  tab,
  active,
  labels,
  locale,
  formatTime,
}: Omit<CouponWalletProps, 'labels'> & { tab: CouponTab; active: boolean; labels: RewardsLabels }) {
  const query = useCoupons(api, tab, { enabled: active })
  if (!active) return null
  if (query.isPending) return <Skeleton lines={3} label={labels.loading} />
  if (query.isError)
    return (
      <Alert
        tone="danger"
        action={
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {labels.retry}
          </Button>
        }
      >
        {labels.loadFailed}
      </Alert>
    )
  if (query.data.length === 0)
    return (
      <EmptyState
        title={tab === 'AVAILABLE' ? labels.coupon.emptyAvailable : labels.coupon.emptyPast}
      />
    )
  return (
    <ul className={styles.list}>
      {query.data.map((coupon) => (
        <li key={coupon.id}>
          <CouponCard coupon={coupon} labels={labels} locale={locale} formatTime={formatTime} />
        </li>
      ))}
    </ul>
  )
}

/** 쿠폰함 — 코드 등록 + 「사용 가능 / 사용·만료」 탭 */
export function CouponWallet({
  api,
  labels = defaultRewardsLabels,
  locale,
  formatTime,
}: CouponWalletProps) {
  const [tab, setTab] = useState<CouponTab>('AVAILABLE')
  const item = (id: CouponTab, label: string) => ({
    id,
    label,
    content: (
      <CouponList
        api={api}
        tab={id}
        active={tab === id}
        labels={labels}
        locale={locale}
        formatTime={formatTime}
      />
    ),
  })
  return (
    <div className={styles.wallet}>
      <RedeemCodeForm api={api} labels={labels} />
      <Tabs
        aria-label={labels.coupon.available}
        value={tab}
        onValueChange={(id) => setTab(id as CouponTab)}
        items={[item('AVAILABLE', labels.coupon.available), item('PAST', labels.coupon.past)]}
      />
    </div>
  )
}
