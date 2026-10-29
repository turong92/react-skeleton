import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import type { BadgeApi } from './badgeApi'
import { BadgeTile, type BadgeTileProps } from './BadgeTile'
import { useProfileBadges } from './queries'
import styles from './ProfileBadges.module.css'

export type ProfileBadgesProps = {
  api: Pick<BadgeApi, 'profileBadges'>
  /** 배지를 볼 계정. **필명(`author-profile`) 화면에는 붙이지 않는다** - 주소에 계정 id 가 담겨 필명 여럿이 한 사람으로 이어진다 */
  accountId: string
  labels?: RewardsLabels
  renderImage?: BadgeTileProps['renderImage']
}

/**
 * 계정의 공개 배지 한 줄 — 로그인 없이 그린다. 불러오는 중 · 실패 · 배지 없음이면 아무것도 그리지 않는다
 * (프로필에 빈 상자를 남기지 않는다).
 * 서버의 공개 경로는 기본이 꺼짐이다 - 앱이 `skeleton.badge.http.allow-anonymous-read: true` 로 켠다. 공개 응답 모양(이름 · 설명 · 그림)만 안다.
 */
export function ProfileBadges({
  api,
  accountId,
  labels = defaultRewardsLabels,
  renderImage,
}: ProfileBadgesProps) {
  const query = useProfileBadges(api, accountId)
  if (!query.data || query.data.length === 0) return null
  return (
    <ul className={styles.row} aria-label={labels.badge.profileTitle}>
      {query.data.map((badge) => (
        <li key={badge.code} className={styles.item} title={badge.description}>
          <BadgeTile
            state="earned"
            size="sm"
            name={badge.name}
            imageUrl={badge.imageUrl}
            renderImage={renderImage}
            labels={labels}
          />
        </li>
      ))}
    </ul>
  )
}
