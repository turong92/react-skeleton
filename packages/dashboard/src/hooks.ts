import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DashboardApi } from './api'
import type { DateSpan } from './types'

/** 개요를 다시 가져오는 간격(밀리초) */
export const DASHBOARD_REFRESH_MS = 60_000

/** 키는 층층이: `all` ⊃ `overview(span, compare)` · `ranking(key, span)` · `realtime` */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  overview: (span: DateSpan, compare: boolean) =>
    [...dashboardKeys.all, 'overview', span.from, span.to, compare] as const,
  ranking: (key: string, span: DateSpan) =>
    [...dashboardKeys.all, 'ranking', key, span.from, span.to] as const,
  realtime: () => [...dashboardKeys.all, 'realtime'] as const,
}

/**
 * 대시보드 개요 — 60초마다 다시 가져온다. 탭이 숨으면 멈추고(`refetchIntervalInBackground: false`) 돌아오면 이어서 가져온다.
 * 기간을 바꾸면 새 값이 올 때까지 이전 값을 보여 준다(깜빡임 없이).
 */
export function useDashboard(api: DashboardApi, span: DateSpan, compare: boolean) {
  return useQuery({
    queryKey: dashboardKeys.overview(span, compare),
    queryFn: () => api.overview(span, compare),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  })
}

/** 순위 한 개의 전체 목록(「전체 보기」) — `enabled` 가 true 일 때만 가져온다 */
export function useRanking(
  api: DashboardApi,
  key: string,
  span: DateSpan,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: dashboardKeys.ranking(key, span),
    queryFn: () => api.ranking(key, span),
    enabled,
  })
}
