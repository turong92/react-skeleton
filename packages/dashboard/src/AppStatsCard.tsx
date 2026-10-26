import { Badge } from '@skeleton/ui'
import { RankingCard, type RankingCardProps } from './RankingCard'

export type AppStatsCardProps = Omit<RankingCardProps, 'group' | 'title' | 'badge'>

/** 앱 통계 카드 - 앱이 기여한 순위(묶음 `app`)를 탭으로. 「앱이 붙임」 배지로 이 숫자의 주인이 앱임을 알린다 */
export function AppStatsCard(props: AppStatsCardProps) {
  return (
    <RankingCard
      {...props}
      group="app"
      title={props.labels.app.title}
      badge={<Badge tone="success">{props.labels.app.badge}</Badge>}
    />
  )
}
