import { todayInZone, formatDate } from '@skeleton/time'
import { Badge, Button, type DateRange, Skeleton } from '@skeleton/ui'
import { useMemo, useState, type ReactNode } from 'react'
import type { DashboardApi } from './api'
import { FunnelBars } from './charts/FunnelBars'
import { DashboardHeader } from './DashboardHeader'
import { useDashboard, useDashboardZone } from './hooks'
import { defaultDashboardLabels, type DashboardLabels } from './labels'
import { MetricChart } from './MetricChart'
import { MetricTiles, type MetricTilesProps } from './MetricTiles'
import { RealtimeBadge } from './RealtimeBadge'
import { RankingCard } from './RankingCard'
import { RankingDialog } from './RankingDialog'
import { spanOf, spanProblem, type DashboardPeriod } from './range'
import type { DashboardRanking, DateSpan } from './types'
import styles from './DashboardView.module.css'

export type DashboardViewProps = {
  api: DashboardApi
  /** 대시보드의 시간대(IANA) - 「오늘」을 어느 날로 셀지. 주지 않으면 서버가 알려 주는 시간대(`range.zone`)를 첫 응답에서 받아 쓴다 */
  zone?: string
  locale?: string
  labels?: DashboardLabels
  /** 제목 아래 한 줄(예: 서비스 이름 · 운영 현황) */
  subtitle?: string
  initialPeriod?: DashboardPeriod
  /** 헤더의 「지금 N명」(기본 켬). 실시간 경로가 없는 서버면 알아서 숨는다 */
  realtime?: boolean
  /** 헤더 오른쪽 끝 자리 - 지금 N명, 편집 단추 */
  headerTrailing?: ReactNode
  /** 타일의 `metric.link` 를 그리는 법(라우터 `Link`) */
  renderLink?: MetricTilesProps['renderLink']
}

/** 묶음 순서 - 이 순서로 놓고, 모르는 묶음은 그 뒤. `app` 은 따로 아래 구역 */
const GROUP_ORDER = ['traffic', 'pages', 'geo']

function groupRankings(rankings: DashboardRanking[]): Map<string, DashboardRanking[]> {
  const groups = new Map<string, DashboardRanking[]>()
  for (const ranking of rankings)
    groups.set(ranking.group, [...(groups.get(ranking.group) ?? []), ranking])
  return groups
}

/**
 * 관리자 대시보드 한 덩어리(시안 E) - 헤더 → 숫자 타일 + 큰 그래프(한 카드) → 순위 카드 격자 → 퍼널 → 앱 통계.
 * 데이터는 `api`(`createDashboardApi`)로, 60초마다 새로 받는다. TanStack Query 의 `QueryClientProvider` 아래에서 쓴다.
 */
export function DashboardView(props: DashboardViewProps) {
  const labels = props.labels ?? defaultDashboardLabels
  const resolved = useDashboardZone(props.api, props.zone)
  if (resolved.zone) return <DashboardBody {...props} zone={resolved.zone} />
  return resolved.isError ? (
    <div className={styles.failed} role="alert">
      <p>{labels.loadFailed}</p>
      <Button variant="secondary" onClick={() => void resolved.refetch()}>
        {labels.retry}
      </Button>
    </div>
  ) : (
    <Skeleton shape="rect" height="360px" label={labels.loading} />
  )
}

function DashboardBody({
  api,
  zone,
  locale,
  labels = defaultDashboardLabels,
  subtitle,
  initialPeriod = '7d',
  headerTrailing,
  realtime = true,
  renderLink,
}: DashboardViewProps & { zone: string }) {
  const [period, setPeriod] = useState<DashboardPeriod>(initialPeriod)
  const [compare, setCompare] = useState(true)
  const today = todayInZone(zone)
  const [applied, setApplied] = useState<DateSpan>(() => spanOf('7d', zone))
  const [draft, setDraft] = useState<DateRange>(() => ({ start: applied.from, end: applied.to }))
  const [selected, setSelected] = useState<string | null>(null)
  const [opened, setOpened] = useState<DashboardRanking | null>(null)

  const span = useMemo(
    () => spanOf(period, zone, applied),
    // 오늘이 바뀌면(자정을 넘기면) 다시 센다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, zone, applied, today],
  )
  const query = useDashboard(api, span, compare)
  const customProblem = spanProblem({ from: draft.start, to: draft.end })

  const data = query.data
  const includesToday = data ? today <= data.range.to : today <= span.to
  const periodLabel =
    period === 'custom'
      ? `${formatDate(span.from, { locale })} ~ ${formatDate(span.to, { locale })}`
      : labels.periods[period]

  const header = (
    <DashboardHeader
      subtitle={subtitle}
      period={period}
      onPeriod={setPeriod}
      compare={compare}
      onCompare={setCompare}
      customDraft={draft}
      onCustomDraft={setDraft}
      onApplyCustom={() => setApplied({ from: draft.start, to: draft.end })}
      customProblem={customProblem === 'long' ? 'long' : null}
      maxDate={today}
      zone={zone}
      locale={locale}
      labels={labels}
      trailing={
        <>
          {realtime && <RealtimeBadge api={api} locale={locale} labels={labels} />}
          {headerTrailing}
        </>
      }
    />
  )

  if (!data) {
    return (
      <div className={styles.view}>
        {header}
        {query.isError ? (
          <div className={styles.failed} role="alert">
            <p>{labels.loadFailed}</p>
            <Button variant="secondary" onClick={() => void query.refetch()}>
              {labels.retry}
            </Button>
          </div>
        ) : (
          <Skeleton shape="rect" height="360px" label={labels.loading} />
        )}
      </div>
    )
  }

  const metric = data.metrics.find((m) => m.key === selected) ?? data.metrics[0]
  const groups = groupRankings(data.rankings)
  const ordered = [
    ...GROUP_ORDER.filter((g) => groups.has(g)),
    ...[...groups.keys()].filter((g) => g !== 'app' && !GROUP_ORDER.includes(g)),
  ]
  const common = { zone: data.range.zone, includesToday, now: query.dataUpdatedAt, locale, labels }

  return (
    <div className={styles.view}>
      {header}
      <section className={styles.panel} aria-label={labels.tilesLabel}>
        <MetricTiles
          metrics={data.metrics}
          selectedKey={metric?.key ?? null}
          onSelect={setSelected}
          compare={compare}
          locale={locale}
          labels={labels}
          renderLink={renderLink}
        />
        {metric && (
          <MetricChart
            metric={metric}
            range={data.range}
            compare={compare}
            includesToday={includesToday}
            now={query.dataUpdatedAt}
            periodLabel={periodLabel}
            locale={locale}
            labels={labels}
          />
        )}
      </section>
      {ordered.length > 0 && (
        <div className={styles.grid}>
          {ordered.map((group) => (
            <RankingCard
              key={group}
              group={group}
              rankings={groups.get(group) ?? []}
              onViewAll={setOpened}
              {...common}
            />
          ))}
        </div>
      )}
      {data.funnel && (
        <section className={styles.section} aria-labelledby="dashboard-funnel">
          <div className={styles.sectionHead}>
            <h2 id="dashboard-funnel">{labels.funnel.title}</h2>
            <span className={styles.hint}>{labels.funnel.hint}</span>
          </div>
          <div className={styles.card}>
            <FunnelBars funnel={data.funnel} labels={labels} locale={locale} />
          </div>
        </section>
      )}
      {groups.has('app') && (
        <section className={styles.section} aria-labelledby="dashboard-app">
          <div className={styles.sectionHead}>
            <h2 id="dashboard-app">{labels.app.title}</h2>
            <Badge tone="success">{labels.app.badge}</Badge>
          </div>
          <div className={styles.grid}>
            <RankingCard
              group="app"
              rankings={groups.get('app') ?? []}
              onViewAll={setOpened}
              {...common}
            />
          </div>
        </section>
      )}
      <RankingDialog
        api={api}
        ranking={opened}
        span={span}
        zone={data.range.zone}
        includesToday={includesToday}
        now={query.dataUpdatedAt}
        locale={locale}
        labels={labels}
        onClose={() => setOpened(null)}
      />
    </div>
  )
}
