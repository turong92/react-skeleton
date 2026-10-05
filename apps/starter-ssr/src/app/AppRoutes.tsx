import { useRoutes } from 'react-router-dom'
import { routes } from '../routes/routes'
import { useRouteMeta } from './useRouteMeta'

/** 라우트 표를 그린다 — 라우터(`StaticRouter` · `BrowserRouter`) 안에서. 이동할 때마다 제목 · 설명도 맞춘다 */
export function AppRoutes() {
  useRouteMeta()
  return useRoutes(routes)
}
