import { BadgeShelf } from '@skeleton/rewards/badge'
import { PageHeader } from '@skeleton/ui'
import { badgeApi } from '../badges/api'
import { LinkButton } from '../components/LinkButton'
import { languageOf, useT } from '../i18n'
import { rewardsLabelsFor } from '../rewards/labels'
import styles from './RewardsPage.module.css'

/** 내 배지 - 받은 것(프로필에 보이기 스위치) · 아직인 것 · 숨은 업적은 「?」. 노트를 만들면 업적 이벤트가 배지를 준다 */
export function BadgesPage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  return (
    <div className={styles.page}>
      <PageHeader
        title={t('rewards.badges.title')}
        description={t('rewards.badges.subtitle')}
        actions={
          <LinkButton to="/rewards" variant="secondary">
            {t('rewards.back')}
          </LinkButton>
        }
      />
      <BadgeShelf api={badgeApi} labels={rewardsLabelsFor(language)} locale={language} />
    </div>
  )
}
