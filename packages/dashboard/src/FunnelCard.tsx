import { FunnelBars } from './charts/FunnelBars'
import type { DashboardLabels } from './labels'
import type { DashboardFunnel } from './types'
import styles from './FunnelCard.module.css'

export type FunnelCardProps = { funnel: DashboardFunnel; locale?: string; labels: DashboardLabels }

/** 퍼널 카드 - 방문한 사람이 어디까지 갔는지(`FunnelBars`) */
export function FunnelCard({ funnel, locale, labels }: FunnelCardProps) {
  return (
    <article className={styles.card} aria-label={labels.funnel.title}>
      <header className={styles.head}>
        <h3 className={styles.title}>{labels.funnel.title}</h3>
        <span className={styles.hint}>{labels.funnel.hint}</span>
      </header>
      <FunnelBars funnel={funnel} labels={labels} locale={locale} />
    </article>
  )
}
