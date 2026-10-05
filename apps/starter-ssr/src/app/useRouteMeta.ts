import { applyHead, buildHeadSpec } from '@skeleton/seo'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { readSiteUrl } from '../ssr/head'
import { routeMatches, seoDefaults, seoMetaOf } from '../routes/routeMeta'
import { routes } from '../routes/routes'

/** 라우트가 바뀔 때마다 머리(제목 · 설명 · canonical · OG · robots)를 맞춘다(처음 로드는 서버가 이미 넣었다 — 같은 규칙이라 같은 값). effect 라 서버에서는 돌지 않는다 */
export function useRouteMeta() {
  const { pathname } = useLocation()
  useEffect(() => {
    const spec = buildHeadSpec(
      seoMetaOf(routeMatches(routes, pathname), pathname),
      seoDefaults(readSiteUrl(document)),
    )
    applyHead(spec, document)
  }, [pathname])
}
