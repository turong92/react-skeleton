import { todayInZone } from '@skeleton/time'
import type { DateSpan } from './types'

export type DashboardPeriod = 'today' | '7d' | '30d' | 'custom'
export const DASHBOARD_PERIODS: readonly DashboardPeriod[] = ['today', '7d', '30d', 'custom']

/** `YYYY-MM-DD` 에 일 수를 더한다(달력 계산이라 시간대와 무관) */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/**
 * 기간 → 조회 날짜. 「오늘」은 오늘 하루, 7일 · 30일은 오늘을 끝으로 거슬러 센다(오늘 포함 — 오늘 분은 실시간으로 채워진다).
 * 「직접」은 고른 날짜 그대로(없으면 7일). 오늘은 대시보드 시간대 기준이라 `zone` 을 준다.
 */
export function spanOf(
  period: DashboardPeriod,
  zone: string,
  custom?: DateSpan,
  now: Date = new Date(),
): DateSpan {
  const today = todayInZone(zone, now)
  switch (period) {
    case 'today':
      return { from: today, to: today }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case 'custom':
      return custom ?? { from: addDays(today, -6), to: today }
  }
}

/** 두 날짜(양 끝 포함) 사이의 일 수 */
export function daysIn({ from, to }: DateSpan): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000) + 1
}

/** 서버가 받는 최대 기간(일) */
export const MAX_SPAN_DAYS = 366

/** 직접 고른 기간이 쓸 수 있나(시작 ≤ 끝, 최대 366일) */
export function spanProblem(span: DateSpan): 'order' | 'long' | null {
  if (span.from > span.to) return 'order'
  return daysIn(span) > MAX_SPAN_DAYS ? 'long' : null
}
