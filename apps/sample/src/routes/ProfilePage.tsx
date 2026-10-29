import { ProfileBadges } from '@skeleton/rewards/badge'
import { PageHeader } from '@skeleton/ui'
import { useParams } from 'react-router-dom'
import { badgeApi } from '../badges/api'
import { languageOf, useT } from '../i18n'
import { rewardsLabelsFor } from '../rewards/labels'
import styles from './RewardsPage.module.css'

/**
 * 계정의 공개 프로필 - 로그인 없이 열리고, 그 계정이 보이기로 한 배지 줄만 그린다(없으면 줄이 없다).
 * **주소에 계정 id 가 담긴다** - 필명(`author-profile`) 화면에는 이 줄을 붙이지 않는다. 필명 여러 개가 한 계정으로 이어져 한 사람임이 드러난다
 */
export function ProfilePage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const { accountId = '' } = useParams()
  return (
    <div className={styles.page}>
      <PageHeader title={t('profile.title')} description={t('profile.subtitle')} />
      <section className={styles.points} aria-labelledby="profile-badges-heading">
        <h2 id="profile-badges-heading">{t('profile.badgesHeading')}</h2>
        <ProfileBadges api={badgeApi} accountId={accountId} labels={rewardsLabelsFor(language)} />
      </section>
    </div>
  )
}
