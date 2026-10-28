import { CouponWallet } from '@skeleton/rewards'
import { PageHeader } from '@skeleton/ui'
import { LinkButton } from '../components/LinkButton'
import { languageOf, useT } from '../i18n'
import { serverClock } from '../api/serverClock'
import { rewardsApi } from '../rewards/api'
import { rewardsLabelsFor } from '../rewards/labels'
import styles from './RewardsPage.module.css'

/** 쿠폰함 - 코드 등록과 받은 쿠폰. 쿠폰을 쓰는 곳은 응원하기(`CouponPicker` + 견적)와 구독 시작이다 */
export function CouponsPage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  return (
    <div className={styles.page}>
      <PageHeader
        title={t('rewards.coupons.title')}
        description={t('rewards.coupons.subtitle')}
        actions={
          <LinkButton to="/rewards" variant="secondary">
            {t('rewards.back')}
          </LinkButton>
        }
      />
      <CouponWallet
        api={rewardsApi}
        labels={rewardsLabelsFor(language)}
        locale={language}
        now={() => serverClock.now().getTime()}
      />
    </div>
  )
}
