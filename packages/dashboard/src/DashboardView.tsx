import { todayInZone, formatDate } from '@skeleton/time'
import { Alert, Button, type DateRange, Skeleton } from '@skeleton/ui'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { DashboardApi } from './api'
import { AppStatsCard } from './AppStatsCard'
import { EditableCard, EditControls } from './DashboardEditor'
import { FunnelCard } from './FunnelCard'
import { DashboardHeader } from './DashboardHeader'
import { useDashboard, useDashboardLayout, useDashboardZone } from './hooks'
import {
  availableCards,
  dropCard,
  layoutToSave,
  moveCard,
  orderedCards,
  toggleHidden,
} from './layout'
import { defaultDashboardLabels, type DashboardLabels } from './labels'
import { MetricChart } from './MetricChart'
import { MetricTiles, type MetricTilesProps } from './MetricTiles'
import { RealtimeBadge } from './RealtimeBadge'
import { RankingCard } from './RankingCard'
import { ReturningCard } from './ReturningCard'
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
  /** 화면 설정(끈 카드 · 순서)을 브라우저에 둘 때 키에 넣는 값 - 보통 계정 id. 서버에 저장소가 있으면 서버(계정별)에 저장한다 */
  layoutKey?: string
  /** 헤더 오른쪽 끝 자리 - 지금 N명, 편집 단추 */
  headerTrailing?: ReactNode
  /** 타일의 `metric.link` 를 그리는 법(라우터 `Link`) */
  renderLink?: MetricTilesProps['renderLink']
}

const RETURNING_KEY = 'ga.returning'

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
  layoutKey,
  renderLink,
}: DashboardViewProps & { zone: string }) {
  const [period, setPeriod] = useState<DashboardPeriod>(initialPeriod)
  const [compare, setCompare] = useState(true)
  const today = todayInZone(zone)
  const [applied, setApplied] = useState<DateSpan>(() => spanOf('7d', zone))
  const [draft, setDraft] = useState<DateRange>(() => ({ start: applied.from, end: applied.to }))
  const [selected, setSelected] = useState<string | null>(null)
  const [opened, setOpened] = useState<DashboardRanking | null>(null)
  const stored = useDashboardLayout(api, layoutKey)
  const [editing, setEditing] = useState(false)
  const [draftHidden, setDraftHidden] = useState<string[]>([])
  const [draftOrder, setDraftOrder] = useState<string[]>([])
  const dragging = useRef<string | null>(null)

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

  // 재방문(`ga.returning`)은 탭이 아니라 작은 숫자 카드로 - 묶음의 탭에서는 뺀다
  const returningRanking = data?.rankings.find((r) => r.key === RETURNING_KEY) ?? null
  const groups = data ? groupRankings(data.rankings.filter((r) => r.key !== RETURNING_KEY)) : null
  const available =
    data && groups
      ? availableCards([...groups.keys()], data.funnel !== null, returningRanking !== null)
      : []
  const current = editing
    ? { hidden: draftHidden, order: draftOrder }
    : { hidden: stored.layout.hidden, order: orderedCards(available, stored.layout.order) }
  const hiddenKeys = new Set(current.hidden)

  function startEdit() {
    stored.resetSaveError()
    setDraftHidden(stored.layout.hidden)
    setDraftOrder(orderedCards(available, stored.layout.order))
    setEditing(true)
  }
  async function finishEdit() {
    try {
      await stored.save(layoutToSave(draftOrder, draftHidden))
      setEditing(false)
    } catch {
      // 저장하지 못했다 - 편집 상태를 그대로 두고 안내(`saveFailed`)를 보인다
    }
  }
  function resetEdit() {
    setDraftHidden([])
    setDraftOrder(available)
  }

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
          {data && (
            <EditControls
              editing={editing}
              saving={stored.saving}
              onEdit={startEdit}
              onDone={() => void finishEdit()}
              onReset={resetEdit}
              labels={labels}
            />
          )}
          {headerTrailing}
        </>
      }
    />
  )

  if (!data || !groups || stored.isPending) {
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

  const visibleMetrics = data.metrics.filter((m) => editing || !hiddenKeys.has(m.key))
  const metric =
    visibleMetrics.find((m) => m.key === selected && !hiddenKeys.has(m.key)) ??
    visibleMetrics.find((m) => !hiddenKeys.has(m.key))
  const common = { zone: data.range.zone, includesToday, now: query.dataUpdatedAt, locale, labels }

  const cardName = (key: string) =>
    key === 'funnel'
      ? labels.funnel.title
      : key === 'returning'
        ? labels.returning.title
        : key === 'app'
          ? labels.app.title
          : (labels.groups[key.replace('rankings.', '')] ?? key.replace('rankings.', ''))
  const cardBody = (key: string) => {
    if (key === 'funnel')
      return <FunnelCard funnel={data.funnel!} locale={locale} labels={labels} />
    if (key === 'returning') return <ReturningCard ranking={returningRanking!} {...common} />
    if (key === 'app') {
      return <AppStatsCard rankings={groups.get('app') ?? []} onViewAll={setOpened} {...common} />
    }
    const group = key.replace('rankings.', '')
    return (
      <RankingCard
        group={group}
        rankings={groups.get(group) ?? []}
        onViewAll={setOpened}
        {...common}
      />
    )
  }

  return (
    <div className={styles.view}>
      {header}
      {editing && (
        <p className={styles.hint} role="note">
          {labels.edit.hint}
          {stored.where === 'browser' && <> {labels.edit.browserOnly}</>}
        </p>
      )}
      {editing && stored.saveFailed && <Alert tone="danger">{labels.edit.saveFailed}</Alert>}
      <section className={styles.panel} aria-label={labels.tilesLabel}>
        <MetricTiles
          metrics={data.metrics}
          selectedKey={metric?.key ?? null}
          onSelect={setSelected}
          compare={compare}
          locale={locale}
          labels={labels}
          editing={editing}
          hiddenKeys={hiddenKeys}
          onToggle={(key) => setDraftHidden((list) => toggleHidden(list, key))}
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
      <div className={styles.grid}>
        {current.order.map((key, index) => (
          <EditableCard
            key={key}
            id={key}
            name={cardName(key)}
            wide={key === 'funnel' || key === 'app'}
            editing={editing}
            hidden={hiddenKeys.has(key)}
            isFirst={index === 0}
            isLast={index === current.order.length - 1}
            onToggle={() => setDraftHidden((list) => toggleHidden(list, key))}
            onMove={(delta) => setDraftOrder((order) => moveCard(order, key, delta))}
            onDragStart={(id) => {
              dragging.current = id
            }}
            onDropOn={(target) => {
              const from = dragging.current
              dragging.current = null
              if (from) setDraftOrder((order) => dropCard(order, from, target))
            }}
            labels={labels}
          >
            {cardBody(key)}
          </EditableCard>
        ))}
      </div>
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
