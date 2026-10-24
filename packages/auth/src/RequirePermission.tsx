import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Alert, Button } from '@skeleton/ui'
import { hasPermission } from './permissions'
import { AccountStateNotice } from './screens/AccountStateNotice'
import { mergeLabels, type AuthLabels } from './screens/labels'
import { useAuth } from './useAuth'

export type RequirePermissionProps = {
  /** 이 권한 하나가 있으면 통과(`*` 는 모두) - 화면용이고 진짜 검사는 서버가 한다. `anyOf` 와 같이 주면 둘 중 하나만 있어도 통과 */
  permission?: string
  /** 이 중 하나만 있으면 통과. 둘 다 안 주면 늘 거절 */
  anyOf?: readonly string[]
  /** 로그인 안 한 방문자를 보낼 곳(돌아올 위치는 `state.from`) */
  redirectTo?: string
  /** 로그인은 했지만 권한이 없을 때 - 로그아웃시키지 않고 이것을 보인다(기본: 「접근 차단」 안내) */
  forbidden?: ReactNode
  /** 권한을 아직 받는 중일 때(저장된 토큰으로 막 열었을 때) 그릴 것 - 기본은 아무것도 안 그린다. 「권한 없음」 안내를 먼저 보이지 않기 위해서다 */
  pending?: ReactNode
  /** 권한을 받으려다 포기했을 때 그릴 것 - 기본은 「권한을 불러오지 못했어요」 + 눌리는 「다시 시도」 단추 */
  failed?: ReactNode
  /** 기본 안내(`failed`)의 문구 */
  labels?: Partial<AuthLabels>
  children?: ReactNode
}

/** 권한 가드. 로그인 안 함 → 로그인으로, 권한 없음 → 안내 화면(세션은 건드리지 않는다). `RequireRole` 의 권한판 */
export function RequirePermission({
  permission,
  anyOf = [],
  redirectTo = '/login',
  forbidden,
  pending = null,
  failed,
  labels,
  children,
}: RequirePermissionProps) {
  const { status, principal, permissionsFailed, retryPermissions } = useAuth()
  const location = useLocation()
  if (status !== 'authenticated')
    return <Navigate to={redirectTo} replace state={{ from: location }} />
  if (!principal || principal.permissions === null) {
    if (!permissionsFailed) return pending
    const text = mergeLabels(labels)
    return (
      failed ?? (
        <Alert
          tone="danger"
          action={
            <Button variant="secondary" size="sm" onClick={retryPermissions}>
              {text.permissionsRetry}
            </Button>
          }
        >
          {text.permissionsLoadFailed}
        </Alert>
      )
    )
  }
  if (!hasPermission(principal.permissions, permission ? [permission, ...anyOf] : anyOf))
    return forbidden ?? <AccountStateNotice kind="blocked" />
  return children ?? <Outlet />
}
