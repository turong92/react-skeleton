import {
  AttendanceCard,
  InviteCard,
  PointBalance,
  PointHistory,
  useCampaigns,
} from '@skeleton/rewards'
import { PageHeader } from '@skeleton/ui'
import { LinkButton } from '../components/LinkButton'
import { languageOf, useT } from '../i18n'
import { rewardsApi } from '../rewards/api'
import { rewardsLabelsFor } from '../rewards/labels'
import styles from './RewardsPage.module.css'

/**
 * 혜택 - 진행 중인 출석 이벤트마다 출석 카드, 초대 이벤트가 있으면 내 초대 코드, 포인트 잔액과 내역.
 * 이벤트가 꺼지면(운영자) 카드가 사라진다. 모듈을 안 붙인 갈래의 카드는 자기 자리에서 「불러오지 못했어요」.
 */
export function RewardsPage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = rewardsLabelsFor(language)
  const campaigns = useCampaigns(rewardsApi)
  const attendance = (campaigns.data ?? []).filter((c) => c.kind === 'attendance')
  const hasReferral = (campaigns.data ?? []).some((c) => c.kind === 'referral')
  return (
    <div className={styles.page}>
      <PageHeader
        title={t('rewards.title')}
        description={t('rewards.subtitle')}
        actions={
          <>
            <LinkButton to="/rewards/badges" variant="secondary">
              {t('rewards.badgesLink')}
            </LinkButton>
            <LinkButton to="/rewards/coupons" variant="secondary">
              {t('rewards.couponsLink')}
            </LinkButton>
          </>
        }
      />
      <div className={styles.cards}>
        {attendance.map((campaign) => (
          <AttendanceCard
            key={campaign.id}
            api={rewardsApi}
            campaignId={campaign.id}
            labels={labels}
          />
        ))}
        {hasReferral && (
          <InviteCard
            api={rewardsApi}
            labels={labels}
            shareText={(code) => `${window.location.origin}/?ref=${encodeURIComponent(code)}`}
          />
        )}
      </div>
      <section className={styles.points} aria-labelledby="points-heading">
        <h2 id="points-heading">{labels.point.balance}</h2>
        <PointBalance api={rewardsApi} labels={labels} locale={language} />
        <PointHistory api={rewardsApi} labels={labels} locale={language} />
      </section>
    </div>
  )
}
