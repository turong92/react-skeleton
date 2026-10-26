import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DashboardApi } from './api'
import type { DateSpan } from './types'

/** 개요를 다시 가져오는 간격(밀리초) */
export const DASHBOARD_REFRESH_MS = 60_000

/** 키는 층층이: `all` ⊃ `overview(span, compare)` · `ranking(key, span)` · `realtime` */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  overview: (span: DateSpan | null, compare: boolean) =>
    [...dashboardKeys.all, 'overview', span?.from ?? null, span?.to ?? null, compare] as const,
  zone: () => [...dashboardKeys.all, 'zone'] as const,
  ranking: (key: string, span: DateSpan) =>
    [...dashboardKeys.all, 'ranking', key, span.from, span.to] as const,
  realtime: () => [...dashboardKeys.all, 'realtime'] as const,
}

/**
 * 대시보드 개요 — 60초마다 다시 가져온다. 탭이 숨으면 멈추고(`refetchIntervalInBackground: false`) 돌아오면 이어서 가져온다.
 * 기간을 바꾸면 새 값이 올 때까지 이전 값을 보여 준다(깜빡임 없이).
 */
export function useDashboard(
  api: DashboardApi,
  span: DateSpan | null,
  compare: boolean,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    enabled,
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

/**
 * 대시보드의 시간대 - 「오늘」 · 7일 · 30일은 브라우저가 아니라 서버의 시간대로 센다. 기간 없이 한 번 불러(서버가 오늘 하루로 읽는다)
 * 응답의 `range.zone` 을 받아 오래 쓴다. `zone` 을 직접 주면 부르지 않는다.
 */
export function useDashboardZone(api: DashboardApi, zone?: string) {
  const query = useQuery({
    queryKey: dashboardKeys.zone(),
    queryFn: async () => (await api.overview(null, false)).range.zone,
    enabled: zone === undefined,
    staleTime: Infinity,
  })
  return { zone: zone ?? query.data ?? null, isError: query.isError, refetch: query.refetch }
}

/**
 * 지금 보는 사람 · 페이지 · 국가 - 60초마다. 이 경로를 여는 모듈이 없으면 404 라 다시 시도하지 않고 `isError` 가 된다(화면은 배지를 숨긴다).
 */
export function useRealtime(api: DashboardApi, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: dashboardKeys.realtime(),
    queryFn: () => api.realtime(),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    retry: false,
    enabled,
  })
}
