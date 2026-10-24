import { usePermission } from '@skeleton/auth'
import { useQuery } from '@tanstack/react-query'
import { createAdminAccountsApi, type AssignableRole } from '@skeleton/auth/admin'
import { apiClient } from '../api/client'

const accountsApi = createAdminAccountsApi(apiClient)

/** 줄 수 있는 역할 목록의 캐시 키 - 역할 화면이 만들기 · 고치기 · 지우기를 마치면 이 키를 무효화한다 */
export const assignableRolesKey = ['admin', 'accounts', 'assignable-roles'] as const

/**
 * 계정 화면에서 줄 수 있는 역할(이름 · 권한) - 서버의 `GET /admin/accounts/assignable-roles`(계정 모듈, 권한 `account.roles`)에서 온다 - 역할 모듈(`authz`)이 없는 서버도 답한다.
 * 답이 오기 전 · 실패(권한 없음 403 · 경로 없음 404)에는 빈 목록 - 이름을 짐작해 채우지 않는다
 */
export function useAssignableRoles(): AssignableRole[] {
  // `account.roles` 가 없는 운영자(예: `account.read` 만)에게는 서버가 늘 403 이라 묻지 않는다
  const enabled = usePermission('account.roles')
  const roles = useQuery({
    queryKey: assignableRolesKey,
    enabled,
    queryFn: () => accountsApi.assignableRoles(),
    retry: false,
  })
  return enabled ? (roles.data ?? []) : []
}
