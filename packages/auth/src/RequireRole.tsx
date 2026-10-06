import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AccountStateNotice } from './screens/AccountStateNotice'
import { useAuth } from './useAuth'

export type RequireRoleProps = {
  /** 이 중 하나만 있으면 통과(백엔드 roles — 토큰의 claim 은 화면용이고 진짜 검사는 서버가 한다) */
  roles: readonly string[]
  /** 로그인 안 한 방문자를 보낼 곳(돌아올 위치는 `state.from`) */
  redirectTo?: string
  /** 로그인은 했지만 역할이 없을 때 — 로그아웃시키지 않고 이것을 보인다(기본: 「접근 차단」 안내) */
  forbidden?: ReactNode
  children?: ReactNode
}

/** 역할 가드. 로그인 안 함 → 로그인으로(403 이 아니라 401 의미), 역할 없음 → 안내 화면(403 의미: 세션은 건드리지 않는다) */
export function RequireRole({
  roles,
  redirectTo = '/login',
  forbidden,
  children,
}: RequireRoleProps) {
  const { status, principal } = useAuth()
  const location = useLocation()
  if (status !== 'authenticated')
    return <Navigate to={redirectTo} replace state={{ from: location }} />
  const allowed = roles.some((role) => principal?.roles.includes(role))
  if (!allowed) return forbidden ?? <AccountStateNotice kind="blocked" />
  return children ?? <Outlet />
}
