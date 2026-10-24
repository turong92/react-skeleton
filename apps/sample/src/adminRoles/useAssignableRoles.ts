import { useQuery } from '@tanstack/react-query'
import { createAdminAccountsApi } from '@skeleton/auth/admin'
import { apiClient } from '../api/client'

const accountsApi = createAdminAccountsApi(apiClient)

export const adminRolesKey = ['admin', 'roles'] as const

/**
 * 계정 화면에서 줄 수 있는 역할 이름 - 서버의 `GET /admin/accounts/assignable-roles`(계정 모듈, 권한 `account.roles`)에서 온다 - 역할 모듈(`authz`)이 없는 서버도 답한다.
 * 답이 오기 전 · 실패(권한 없음 403 · 경로 없음 404)에는 빈 목록 - 이름을 짐작해 채우지 않는다
 */
export function useAssignableRoles(): string[] {
  const roles = useQuery({
    queryKey: adminRolesKey,
    queryFn: () => accountsApi.assignableRoles(),
    retry: false,
  })
  return roles.data?.map((role) => role.name) ?? []
}
