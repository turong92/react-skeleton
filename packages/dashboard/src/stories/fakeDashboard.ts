import type { DashboardApi } from '../api'
import { ApiRequestError } from '@skeleton/api-client'
import type {
  DashboardAmount,
  DashboardLayout,
  DashboardMetric,
  DashboardOverview,
  DashboardPoint,
  DashboardRanking,
  DashboardStatus,
} from '../types'

/** 스토리 · 시험용 가짜 대시보드 API - 메모리 안의 숫자(7일, 서울 시간대, 일 단위) */

const DAYS = [
  '2026-10-19',
  '2026-10-20',
  '2026-10-21',
  '2026-10-22',
  '2026-10-23',
  '2026-10-24',
  '2026-10-25',
]
const at = (day: string) => `${day}T15:00:00Z` // 서울 자정 = 전날 15:00Z

const series = (base: number, wave: number): DashboardPoint[] =>
  DAYS.map((day, i) => ({
    at: at(day),
    value: Math.round(base + wave * Math.sin(i * 1.3) + i * (base / 20)),
  }))

const money = (amount: number, currency: string): DashboardAmount => ({ amount, currency })
const count = (amount: number): DashboardAmount => ({ amount, currency: null })

const ASOF = '2026-10-26T04:30:00Z'

export type FakeDashboardOptions = {
  /** false 면 Cloudflare · GA 출처는 `NOT_CONNECTED`(키 없이 띄운 모습) */
  connected?: boolean
  /** 개요 호출을 이 시간(ms) 뒤에 답한다(로딩 모습) */
  delayMs?: number
  /** `unavailable` 이면 화면 설정 저장소가 없다(404 `DASHBOARD.LAYOUT_UNAVAILABLE`) - 기본은 메모리 안 서버 저장 */
  layout?: 'server' | 'unavailable' | 'rejects'
  /** 퍼널의 상태(기본 `OK`, 아니면 단계가 비어 온다) */
  funnelStatus?: 'OK' | 'TOO_LARGE' | 'ERROR'
  /** false 면 실시간 경로가 없다(404), `not-connected` 면 200 인데 `NOT_CONNECTED`(GA 키 없음) */
  realtime?: boolean | 'not-connected'
  /** true 면 개요 호출이 실패한다 */
  failing?: boolean
}

function metric(
  over: Partial<DashboardMetric> & Pick<DashboardMetric, 'key' | 'label' | 'unit' | 'source'>,
): DashboardMetric {
  return {
    status: 'OK',
    freshness: { kind: 'LIVE', asOf: ASOF },
    value: [count(0)],
    previousValue: null,
    series: null,
    previousSeries: null,
    link: null,
    ...over,
  }
}

function ranking(
  key: string,
  group: string,
  label: string,
  source: string,
  columns: string[],
  rows: [string, ...number[]][],
  status: DashboardStatus,
): DashboardRanking {
  const ok = status === 'OK'
  return {
    key,
    group,
    label,
    source,
    status,
    freshness: ok ? { kind: source === 'app' ? 'LIVE' : 'DAILY', asOf: ASOF } : null,
    columns,
    rows: ok ? rows.map(([name, ...values]) => ({ label: name, values })) : [],
  }
}

export function fakeOverview({
  connected = true,
  funnelStatus = 'OK',
}: Pick<FakeDashboardOptions, 'connected' | 'funnelStatus'> = {}): DashboardOverview {
  const external: DashboardStatus = connected ? 'OK' : 'NOT_CONNECTED'
  const daily = connected ? { kind: 'DAILY' as const, asOf: ASOF } : null
  const metrics: DashboardMetric[] = [
    metric({
      key: 'cloudflare.visits',
      label: 'Visits',
      unit: 'PEOPLE',
      source: 'cloudflare',
      status: external,
      freshness: daily,
      value: connected ? [count(12480)] : null,
      previousValue: connected ? [count(11750)] : null,
      series: connected ? series(1700, 300) : null,
      previousSeries: connected ? series(1600, 250) : null,
    }),
    metric({
      key: 'cloudflare.pageviews',
      label: 'Pageviews',
      unit: 'COUNT',
      source: 'cloudflare',
      status: external,
      freshness: daily,
      value: connected ? [count(31200)] : null,
      previousValue: connected ? [count(30900)] : null,
      series: connected ? series(4400, 600) : null,
      previousSeries: connected ? series(4300, 500) : null,
    }),
    metric({
      key: 'account.signed-up',
      label: 'Signed up',
      unit: 'PEOPLE',
      source: 'db',
      value: [count(128)],
      previousValue: [count(114)],
      series: series(18, 6),
      previousSeries: series(16, 5),
    }),
    metric({
      key: 'auth-session.active',
      label: 'Active users',
      unit: 'PEOPLE',
      source: 'db',
      value: [count(912)],
      previousValue: null,
      series: series(130, 20),
      previousSeries: null,
    }),
    metric({
      key: 'payment.net-revenue',
      label: 'Net revenue',
      unit: 'MONEY',
      source: 'db',
      value: [money(4_610_000, 'KRW'), money(99_000, 'USD')],
      previousValue: [money(4_240_000, 'KRW'), money(120_000, 'USD')],
      series: series(658_000, 120_000),
      previousSeries: series(600_000, 100_000),
      link: '/admin/payments',
    }),
    metric({
      key: 'payment.paid-count',
      label: 'Paid orders',
      unit: 'COUNT',
      source: 'db',
      value: [count(87)],
      previousValue: [count(91)],
      series: series(12, 4),
      previousSeries: series(13, 4),
      link: '/admin/payments',
    }),
  ]
  const rankings: DashboardRanking[] = [
    ranking(
      'cloudflare.referrers',
      'traffic',
      'Sources',
      'cloudflare',
      ['Source', 'Visits'],
      [
        ['google.com', 2140],
        ['direct', 1820],
        ['instagram.com', 960],
        ['t.co', 540],
        ['naver.com', 412],
      ],
      external,
    ),
    ranking(
      'ga.channels',
      'traffic',
      'Channels',
      'ga',
      ['Channel', 'Sessions', 'Conversions'],
      [
        ['Organic Search', 4210, 102],
        ['Direct', 2980, 64],
        ['Social', 2230, 71],
      ],
      'NOT_CONNECTED',
    ),
    ranking(
      'ga.returning',
      'traffic',
      'Returning',
      'ga',
      ['Users'],
      [
        ['New', 380],
        ['Returning', 120],
      ],
      'OK',
    ),
    ranking(
      'cloudflare.paths',
      'pages',
      'Top pages',
      'cloudflare',
      ['Page', 'Views'],
      [
        ['/s/sample-birthday', 3210],
        ['/', 2880],
        ['/templates', 1640],
      ],
      external,
    ),
    ranking(
      'ga.page-transitions',
      'pages',
      'Page transitions',
      'ga',
      ['Transition', 'Count'],
      [['/ → /templates', 1420]],
      'NOT_CONNECTED',
    ),
    ranking(
      'cloudflare.countries',
      'geo',
      'Countries',
      'cloudflare',
      ['Country', 'Visits'],
      [
        ['South Korea', 8120],
        ['United States', 1240],
        ['Japan', 980],
      ],
      external,
    ),
    ranking(
      'cloudflare.devices',
      'geo',
      'Devices',
      'cloudflare',
      ['Device', 'Visits'],
      [
        ['Mobile', 7240],
        ['Desktop', 4580],
        ['Tablet', 660],
      ],
      external,
    ),
    ranking(
      'app.templates',
      'app',
      'Templates used',
      'app',
      ['Template', 'Uses'],
      [
        ['Birthday board', 412],
        ['Debut anniversary', 305],
      ],
      'OK',
    ),
  ]
  return {
    range: { from: '2026-10-20', to: '2026-10-26', zone: 'Asia/Seoul', interval: 'DAY' },
    previous: { from: '2026-10-13', to: '2026-10-19' },
    metrics,
    rankings,
    funnel: {
      status: funnelStatus,
      steps:
        funnelStatus !== 'OK'
          ? []
          : [
              { key: 'account.signed-up', label: 'Signed up', reached: 128, rate: 1 },
              { key: 'app.activated', label: 'Activated', reached: 96, rate: 0.75 },
              { key: 'payment.paid', label: 'Paid', reached: 41, rate: 0.43 },
            ],
      reference: connected
        ? { key: 'cloudflare.visits', label: 'Visits', value: 12480, rate: 0.01 }
        : null,
    },
  }
}

const layoutUnavailable = () =>
  new ApiRequestError(
    {
      code: 'DASHBOARD.LAYOUT_UNAVAILABLE',
      title: 'Layout unavailable',
      status: 404,
      timestamp: '2026-10-26T00:00:00Z',
    },
    'trace',
    'span',
    '00-trace-span-01',
  )

const notFound = () => new Error('404 fake: this endpoint is not open')

/** 호출 기록을 같이 돌려준다(`calls.overview` …) */
export function createFakeDashboardApi(options: FakeDashboardOptions = {}) {
  const calls = {
    overview: [] as { from: string | null; to: string | null; compare: boolean }[],
    ranking: [] as string[],
    layoutSaved: [] as DashboardLayout[],
  }
  let layout: DashboardLayout = { hidden: [], order: [] }
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, options.delayMs ?? 0))
  const api: DashboardApi = {
    overview: async (span, compare) => {
      calls.overview.push({ from: span?.from ?? null, to: span?.to ?? null, compare })
      await wait()
      if (options.failing) throw notFound()
      const overview = fakeOverview(options)
      return compare
        ? overview
        : {
            ...overview,
            previous: null,
            metrics: overview.metrics.map((m) => ({
              ...m,
              previousValue: null,
              previousSeries: null,
            })),
          }
    },
    ranking: async (key) => {
      calls.ranking.push(key)
      const found = fakeOverview(options).rankings.find((r) => r.key === key)
      if (!found) throw notFound()
      const extra = Array.from({ length: 20 }, (_, i): [string, ...number[]] => [
        `item-${i + 1}`,
        100 - i,
      ])
      return {
        ...found,
        rows: [
          ...found.rows,
          ...(found.status === 'OK' ? extra.map(([label, ...values]) => ({ label, values })) : []),
        ],
      }
    },
    realtime: async () => {
      if (options.realtime === false) throw notFound()
      if (options.realtime === 'not-connected') {
        return {
          status: 'NOT_CONNECTED' as const,
          freshness: null,
          activeUsers: null,
          pages: [],
          countries: [],
        }
      }
      return {
        status: 'OK' as const,
        freshness: { kind: 'CACHED' as const, asOf: ASOF },
        activeUsers: 7,
        pages: [
          { label: '/s/sample-birthday', values: [4] },
          { label: '/', values: [3] },
        ],
        countries: [
          { label: 'South Korea', values: [5] },
          { label: 'Japan', values: [2] },
        ],
      }
    },
    layout: async () => {
      if (options.layout === 'unavailable') throw layoutUnavailable()
      return layout
    },
    saveLayout: async (next) => {
      if (options.layout === 'unavailable') throw layoutUnavailable()
      if (options.layout === 'rejects') throw notFound() // 저장 실패(서버 오류)
      calls.layoutSaved.push(next)
      layout = next
      return layout
    },
  }
  return { api, calls }
}
