import { formatInstant } from '@skeleton/time'
import { Alert, Button, EmptyState, Skeleton, Switch } from '@skeleton/ui'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import type { BadgeApi } from './badgeApi'
import { BadgeTile, type BadgeTileProps } from './BadgeTile'
import { useMyBadges, useSetBadgeVisible } from './queries'
import styles from './BadgeShelf.module.css'

export type BadgeShelfProps = {
  api: Pick<BadgeApi, 'myBadges' | 'setBadgeVisible'>
  labels?: RewardsLabels
  locale?: string
  formatTime?: (iso: string) => string
  renderImage?: BadgeTileProps['renderImage']
}

/**
 * 내 배지 선반 - 받은 것(격자 + 「프로필에 보이기」 스위치) · 아직인 것(흐리게, 숨은 업적은 「?」).
 * 스위치는 로그인한 본인만 만진다(`PATCH me/{awardId}`).
 */
export function BadgeShelf({
  api,
  labels = defaultRewardsLabels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  renderImage,
}: BadgeShelfProps) {
  const t = labels.badge
  const query = useMyBadges(api)
  const setVisible = useSetBadgeVisible(api)
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
  const { earned, locked } = query.data
  if (earned.length === 0 && locked.length === 0) return <EmptyState title={t.emptyAll} />
  return (
    <div className={styles.shelf}>
      {setVisible.isError && <Alert tone="danger">{t.visibleFailed}</Alert>}
      <section aria-labelledby="badge-earned" className={styles.section}>
        <h3 id="badge-earned" className={styles.heading}>
          {t.earned}
        </h3>
        {earned.length === 0 ? (
          <EmptyState title={t.emptyEarned} />
        ) : (
          <ul className={styles.grid}>
            {earned.map((badge) => (
              <li key={badge.awardId} className={styles.cell}>
                <BadgeTile
                  state="earned"
                  name={badge.name}
                  description={badge.description}
                  imageUrl={badge.imageUrl}
                  renderImage={renderImage}
                  labels={labels}
                >
                  <span className={styles.meta}>
                    {t.awardedAt(formatTime(badge.awardedAt))}
                    {badge.archived && ` · ${t.archived}`}
                  </span>
                  <Switch
                    label={t.showOnProfile}
                    checked={badge.visible}
                    disabled={
                      setVisible.isPending && setVisible.variables?.awardId === badge.awardId
                    }
                    onChange={(event) =>
                      setVisible.mutate({ awardId: badge.awardId, visible: event.target.checked })
                    }
                  />
                </BadgeTile>
              </li>
            ))}
          </ul>
        )}
      </section>
      {locked.length > 0 && (
        <section aria-labelledby="badge-locked" className={styles.section}>
          <h3 id="badge-locked" className={styles.heading}>
            {t.locked}
          </h3>
          <ul className={styles.grid}>
            {locked.map((badge, index) => (
              <li key={badge.code ?? `hidden-${index}`} className={styles.cell}>
                <BadgeTile
                  state={badge.hidden ? 'hidden' : 'locked'}
                  name={badge.name}
                  description={badge.description}
                  imageUrl={badge.imageUrl}
                  renderImage={renderImage}
                  labels={labels}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
