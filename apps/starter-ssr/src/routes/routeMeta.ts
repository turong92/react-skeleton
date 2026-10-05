import type { ApiClient } from '@skeleton/api-client'
import type { QueryClient } from '@tanstack/react-query'
import { matchRoutes, type RouteObject } from 'react-router-dom'
import { APP_NAME } from '../appName'

export type PrefetchContext = {
  queryClient: QueryClient
  /** 서버 렌더의 백엔드 클라이언트(토큰 없음) */
  api: Pick<ApiClient, 'value'>
}

/** 라우트의 `handle` — 문서 제목 · 설명과 서버가 첫 그림 전에 미리 가져올 데이터 */
export type RouteHandle = {
  /** 페이지 이름 — 문서 제목은 `<title> · <앱 이름>` */
  title: string
  description: string
  /** 예: `noindex`(계정 · 404 처럼 검색에 안 뜨게 할 페이지) */
  robots?: string
  /** 서버가 이 페이지를 그리기 전에 부른다. 실패해도 렌더는 계속된다(`prefetchQuery` 는 던지지 않는다) */
  prefetch?: (context: PrefetchContext) => Promise<unknown>
}

export const handleOf = (route: RouteObject): RouteHandle | undefined =>
  route.handle as RouteHandle | undefined

/** 주소와 맞는 라우트 사슬(바깥 → 안쪽). 맞는 것이 없으면 빈 배열 */
export function routeMatches(routes: RouteObject[], path: string): RouteObject[] {
  return (matchRoutes(routes, path) ?? []).map((match) => match.route)
}

/** 사슬에서 가장 안쪽 `handle` 의 제목 · 설명 · robots */
export function documentMeta(chain: RouteObject[]): {
  title: string
  description: string
  robots?: string
} {
  const handle = [...chain].reverse().map(handleOf).find(Boolean)
  return {
    title: handle ? `${handle.title} · ${APP_NAME}` : APP_NAME,
    description: handle?.description ?? APP_NAME,
    robots: handle?.robots,
  }
}
