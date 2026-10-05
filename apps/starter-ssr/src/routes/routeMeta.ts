import type { ApiClient } from '@skeleton/api-client'
import type { JsonLdNode, SeoDefaults, SeoMeta } from '@skeleton/seo'
import type { QueryClient } from '@tanstack/react-query'
import { matchRoutes, type RouteObject } from 'react-router-dom'
import { APP_NAME } from '../appName'

export type PrefetchContext = {
  queryClient: QueryClient
  /** 서버 렌더의 백엔드 클라이언트(토큰 없음) */
  api: Pick<ApiClient, 'value'>
}

/** 라우트의 `handle` — 문서 제목 · 설명 · 공유 미리보기와 서버가 첫 그림 전에 미리 가져올 데이터 */
export type RouteHandle = {
  /** 페이지 이름 — 문서 제목은 `<title> · <앱 이름>` */
  title: string
  description: string
  /** 예: `noindex`(계정 · 404 처럼 검색에 안 뜨게 할 페이지) — 이런 페이지는 canonical 도 쓰지 않는다 */
  robots?: string
  /** 링크 미리보기(`og:image`) — 사이트 안 경로 또는 절대 주소 */
  image?: string
  /** 구조화 데이터(`@skeleton/seo` 의 `organizationLd` · `faqLd` …) */
  jsonLd?: JsonLdNode | JsonLdNode[]
  /** 서버가 이 페이지를 그리기 전에 부른다. 실패해도 렌더는 계속된다(`prefetchQuery` 는 던지지 않는다) */
  prefetch?: (context: PrefetchContext) => Promise<unknown>
}

export const handleOf = (route: RouteObject): RouteHandle | undefined =>
  route.handle as RouteHandle | undefined

/** 주소와 맞는 라우트 사슬(바깥 → 안쪽). 맞는 것이 없으면 빈 배열 */
export function routeMatches(routes: RouteObject[], path: string): RouteObject[] {
  return (matchRoutes(routes, path) ?? []).map((match) => match.route)
}

/** 사이트 기본값 — 사이트 이름은 앱 이름, 제목은 `<페이지> · <앱>`. `siteUrl`(SITE_URL)이 없으면 절대 주소가 필요한 태그는 빠진다 */
export const seoDefaults = (siteUrl: string | undefined): SeoDefaults => ({
  siteName: APP_NAME,
  titleTemplate: `%s · ${APP_NAME}`,
  baseUrl: siteUrl,
})

/** 사슬에서 가장 안쪽 `handle` → 이 페이지의 SEO. 검색에서 뺀 페이지(robots 가 있는)는 canonical 을 쓰지 않는다 */
export function seoMetaOf(chain: RouteObject[], pathname: string): SeoMeta {
  const handle = [...chain].reverse().map(handleOf).find(Boolean)
  return {
    title: handle?.title,
    description: handle?.description,
    robots: handle?.robots,
    canonical: handle?.robots ? undefined : pathname,
    image: handle?.image,
    jsonLd: handle?.jsonLd,
  }
}
