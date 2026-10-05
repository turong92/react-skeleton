import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export type RequireAuthProps = {
  /** 로그인 안 한 방문자를 보낼 곳. 돌아올 위치는 `location.state.from` 에 담는다 */
  redirectTo?: string
  /** 없으면 중첩 라우트(`<Outlet />`)를 그린다 */
  children?: ReactNode
}

/** 라우트 가드 — 레이아웃 라우트의 `element: <RequireAuth />` 로 쓰거나 `<RequireAuth>…</RequireAuth>` 로 감싼다 */
export function RequireAuth({ redirectTo = '/login', children }: RequireAuthProps) {
  const { status } = useAuth()
  const location = useLocation()
  if (status !== 'authenticated') {
    return <Navigate to={redirectTo} replace state={{ from: location }} />
  }
  return children ?? <Outlet />
}
