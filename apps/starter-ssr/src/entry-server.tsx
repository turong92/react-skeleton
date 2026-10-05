import type { ApiClient } from '@skeleton/api-client'
import { createAuthApi } from '@skeleton/auth'
import { buildHeadSpec } from '@skeleton/seo'
import { dehydrate } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import type { Render, RenderResult } from '../server/contract.ts'
import { createServerApiClient } from './api/createServerApiClient'
import { AppProviders } from './app/AppProviders'
import { AppRoutes } from './app/AppRoutes'
import { QUERY_STALE_TIME_MS } from './app/constants'
import { createQueryClient } from './app/createQueryClient'
import { createAuth, createDeferredTokens } from './auth/createAuth'
import { handleOf, routeMatches, seoDefaults, seoMetaOf } from './routes/routeMeta'
import { routes } from './routes/routes'
import { buildHead } from './ssr/head'

export type RenderOptions = {
  /** 백엔드 클라이언트(토큰 없음) — 테스트는 가짜 어댑터를 단 것을 넘긴다 */
  api: Pick<ApiClient, 'value'>
  /** 첫 데이터를 기다리는 최대 시간(기본 2000ms). 넘으면 데이터 없이 그린다 */
  prefetchTimeoutMs?: number
  /** 사이트의 공개 주소(`SITE_URL`) — canonical · `og:url` 의 바탕. 없으면 그 태그는 빠진다 */
  siteUrl?: string
}

/** 시간 안에 끝나는 것만 기다린다 — 끝나지 않아도 렌더는 계속된다 */
async function within(promise: Promise<unknown>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([promise, new Promise((resolve) => (timer = setTimeout(resolve, ms)))])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 요청 하나를 그린다 — 라우트를 맞춰 보고(없으면 404) → 그 라우트의 `prefetch` 로 첫 데이터를 가져와(시간 제한 · 실패해도 계속) →
 * `renderToString` → 제목 · 설명 · dehydrate 한 쿼리 캐시를 `head` 로. 요청마다 새 `QueryClient` · 세션을 만든다(요청 사이에 상태가 섞이지 않는다).
 * 로그인 여부는 서버가 모른다(토큰은 브라우저에만 있다) — 보호 라우트는 자리 표시만 그리고 200 이다.
 */
export async function render(
  url: string,
  { api, prefetchTimeoutMs = 2000, siteUrl }: RenderOptions,
): Promise<RenderResult> {
  const { pathname } = new URL(url, 'http://localhost')
  const chain = routeMatches(routes, pathname)
  const status = chain.length === 0 || chain.at(-1)?.path === '*' ? 404 : 200

  const queryClient = createQueryClient({ staleTime: QUERY_STALE_TIME_MS })
  const prefetches = chain.flatMap(
    (route) => handleOf(route)?.prefetch?.({ queryClient, api }) ?? [],
  )
  await within(Promise.all(prefetches), prefetchTimeoutMs)

  const auth = createAuth({ api: createAuthApi(api), tokens: createDeferredTokens() })
  const html = renderToString(
    <StrictMode>
      <AppProviders queryClient={queryClient} api={api} auth={auth}>
        <StaticRouter location={url}>
          <AppRoutes />
        </StaticRouter>
      </AppProviders>
    </StrictMode>,
  )
  const spec = buildHeadSpec(seoMetaOf(chain, pathname), seoDefaults(siteUrl))
  return {
    status,
    html,
    title: spec.title,
    head: buildHead({ spec, state: dehydrate(queryClient), siteUrl }),
  }
}

/** Node 서버가 쓰는 꼴 — 설정(`readServerConfig`)에서 백엔드 클라이언트를 한 번 만들고 요청마다 `render` 를 부른다 */
export function createRenderer(config: {
  apiBaseUrl: string
  apiTimeoutMs: number
  siteUrl?: string
}): Render {
  const api = createServerApiClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.apiTimeoutMs })
  return (url) =>
    render(url, { api, prefetchTimeoutMs: config.apiTimeoutMs + 250, siteUrl: config.siteUrl })
}
