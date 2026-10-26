/** 백엔드 `modules/dashboard` 관리 API 응답(kotlin-skeleton docs/dashboard-http-contract.md, 계약 C1). 모두 `dashboard.read` 권한 */

export type DashboardInterval = 'HOUR' | 'DAY' | 'WEEK'
export type DashboardUnit = 'PEOPLE' | 'COUNT' | 'MONEY' | 'PERCENT'
/** `OK` 만 숫자가 있다. `NOT_CONNECTED` 키 없음 · `NO_HISTORY` 지난 기간인데 적재 표 없음 · `ERROR` 외부 호출 실패(화면 전체를 막지 않는다) */
export type DashboardStatus = 'OK' | 'NOT_CONNECTED' | 'NO_HISTORY' | 'ERROR'

export type DashboardFreshness = {
  /** `LIVE` 지금 계산 · `CACHED` 외부에서 가져온 시각이 asOf · `DAILY` 하루 한 번 적재한 시각이 asOf */
  kind: 'LIVE' | 'CACHED' | 'DAILY'
  asOf: string | null
}

/** 돈이 아니면 `currency` 는 null. 돈은 통화의 최소 단위 정수(KRW 0자리 · USD 센트) */
export type DashboardAmount = { amount: number; currency: string | null }
export type DashboardPoint = { at: string; value: number }
export type DashboardRow = { label: string; values: number[] }

export type DashboardRange = {
  from: string
  to: string
  zone: string
  interval: DashboardInterval
}

export type DashboardMetric = {
  key: string
  label: string
  unit: DashboardUnit
  source: string
  status: DashboardStatus
  freshness: DashboardFreshness | null
  value: DashboardAmount[] | null
  /** `compare=true` 여도 비교할 수 없는 지표(활성 이용자)는 null */
  previousValue: DashboardAmount[] | null
  series: DashboardPoint[] | null
  previousSeries: DashboardPoint[] | null
  link: string | null
}

export type DashboardRanking = {
  key: string
  group: string
  label: string
  source: string
  status: DashboardStatus
  freshness: DashboardFreshness | null
  columns: string[]
  rows: DashboardRow[]
}

export type DashboardFunnelStep = {
  key: string
  label: string
  reached: number
  rate: number
}

export type DashboardFunnel = {
  steps: DashboardFunnelStep[]
  /** 퍼널 앞의 기준(예: 방문 수) — 없으면 null */
  reference: { key: string; label: string; value: number; rate: number } | null
}

export type DashboardOverview = {
  range: DashboardRange
  previous: { from: string; to: string } | null
  metrics: DashboardMetric[]
  rankings: DashboardRanking[]
  funnel: DashboardFunnel | null
}

export type DashboardRealtime = {
  status: DashboardStatus
  freshness: DashboardFreshness | null
  activeUsers: number | null
  pages: DashboardRow[]
  countries: DashboardRow[]
}

/** 화면 설정(계정별) — 숨긴 카드 키와 카드 순서 */
export type DashboardLayout = { hidden: string[]; order: string[] }

/** 조회 기간 — 대시보드 시간대의 날짜(`YYYY-MM-DD`, 양 끝 포함) */
export type DateSpan = { from: string; to: string }
