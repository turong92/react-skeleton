import { ProfileBadges, useProfileBadges } from '@skeleton/rewards/badge'
import { EmptyState, PageHeader, Skeleton } from '@skeleton/ui'
import { useParams } from 'react-router-dom'
import { badgeApi } from '../badges/api'
import { languageOf, useT } from '../i18n'
import { rewardsLabelsFor } from '../rewards/labels'
import styles from './ProfilePage.module.css'

/**
 * 계정의 공개 배지 - 로그인 없이 열리고, 그 계정이 보이기로 한 배지 줄만 그린다. 배지가 없거나(없는 계정도 같다) 읽지 못하면 빈 문구.
 * **주소에 계정 id 가 담긴다** - 필명(`author-profile`) 화면에는 이 줄을 붙이지 않는다. 필명 여러 개가 한 계정으로 이어져 한 사람임이 드러난다
 */
export function ProfilePage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const { accountId = '' } = useParams()
  // 같은 키라 `ProfileBadges` 의 읽기와 한 번이다
  const badges = useProfileBadges(badgeApi, accountId)
  return (
    <div className={styles.page}>
      <PageHeader title={t('profile.title')} description={t('profile.subtitle')} />
      {badges.isPending ? (
        <Skeleton lines={2} label={t('common.loading')} />
      ) : !badges.data || badges.data.length === 0 ? (
        <EmptyState title={t('profile.empty')} headingLevel={2} />
      ) : (
        <section className={styles.badges} aria-labelledby="public-badges-heading">
          <h2 id="public-badges-heading">{t('profile.badgesHeading')}</h2>
          <ProfileBadges api={badgeApi} accountId={accountId} labels={rewardsLabelsFor(language)} />
        </section>
      )}
    </div>
  )
}
