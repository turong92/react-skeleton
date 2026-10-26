import type { ApiClient } from '@skeleton/api-client'
import type {
  DashboardLayout,
  DashboardOverview,
  DashboardRanking,
  DashboardRealtime,
  DateSpan,
} from './types'

export type DashboardApi = {
  /** `GET {basePath}?from&to&compare` — 타일 · 순위 · 퍼널을 한 번에 */
  overview(span: DateSpan, compare: boolean): Promise<DashboardOverview>
  /** `GET {basePath}/rankings/{key}?from&to&limit` — 「전체 보기」(limit ≤ 500) */
  ranking(key: string, span: DateSpan, limit?: number): Promise<DashboardRanking>
  /** `GET {basePath}/realtime` — 지금 보는 사람 · 페이지 · 국가. 이 경로를 여는 모듈이 없으면 404 */
  realtime(): Promise<DashboardRealtime>
  /** `GET {basePath}/layout` — 저장소(`dashboard-jdbc`)가 없으면 404 `DASHBOARD.LAYOUT_UNAVAILABLE` */
  layout(): Promise<DashboardLayout>
  /** `PUT {basePath}/layout` */
  saveLayout(layout: DashboardLayout): Promise<DashboardLayout>
}

export type DashboardApiOptions = {
  /** 관리 API 의 경로(기본 `/admin/dashboard`, `/api/v1` 은 클라이언트의 baseUrl) */
  basePath?: string
}

/** 대시보드 HTTP 호출 모음. 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createDashboardApi(
  client: Pick<ApiClient, 'value'>,
  { basePath = '/admin/dashboard' }: DashboardApiOptions = {},
): DashboardApi {
  const base = basePath.replace(/\/+$/, '')
  return {
    overview: (span, compare) =>
      client.value<DashboardOverview>(base, {
        params: { from: span.from, to: span.to, compare },
      }),
    ranking: (key, span, limit = 100) =>
      client.value<DashboardRanking>(`${base}/rankings/${encodeURIComponent(key)}`, {
        params: { from: span.from, to: span.to, limit },
      }),
    realtime: () => client.value<DashboardRealtime>(`${base}/realtime`),
    layout: () => client.value<DashboardLayout>(`${base}/layout`),
    saveLayout: (layout) =>
      client.value<DashboardLayout>(`${base}/layout`, { method: 'PUT', json: layout }),
  }
}
