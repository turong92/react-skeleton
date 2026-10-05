import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { documentMeta, routeMatches } from '../routes/routeMeta'
import { routes } from '../routes/routes'
import { applyDocumentMeta } from '../ssr/applyDocumentMeta'

/** 라우트가 바뀔 때마다 제목 · 설명을 맞춘다(처음 로드는 서버가 이미 넣었다). effect 라 서버에서는 돌지 않는다 */
export function useRouteMeta() {
  const { pathname } = useLocation()
  useEffect(() => {
    applyDocumentMeta(document, documentMeta(routeMatches(routes, pathname)))
  }, [pathname])
}
