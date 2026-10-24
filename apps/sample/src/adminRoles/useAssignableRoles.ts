import { useQuery } from '@tanstack/react-query'
import { adminRolesApi } from './api'

export const adminRolesKey = ['admin', 'roles'] as const

/**
 * 계정 화면에서 줄 수 있는 역할 이름 - 서버의 `GET /admin/roles`(권한 `authz.roles` 또는 `account.roles`)에서 온다.
 * 답이 오기 전 · 실패(역할 모듈이 없는 서버의 404, 권한 없음 403)에는 빈 목록 - 이름을 짐작해 채우지 않는다
 */
export function useAssignableRoles(): string[] {
  const roles = useQuery({
    queryKey: adminRolesKey,
    queryFn: () => adminRolesApi.list(),
    retry: false,
  })
  return roles.data?.map((role) => role.name) ?? []
}
