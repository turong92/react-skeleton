import { usePermission } from '@skeleton/auth'
import { useQuery } from '@tanstack/react-query'
import { adminRolesApi } from './api'

/** 역할 목록의 캐시 키 */
export const adminRolesKey = ['admin', 'roles', 'choices'] as const

/**
 * 공지 대상 「역할」 에서 고를 역할 - 서버의 `GET /admin/roles`(권한 `authz.roles`)에서 온다.
 * 권한이 없거나 답이 오기 전 · 실패에는 빈 목록 - 공지 편집 화면이 이름을 직접 적게 한다
 */
export function useRoleChoices(): Array<{ value: string; label: string }> {
  const enabled = usePermission('authz.roles')
  const roles = useQuery({
    queryKey: adminRolesKey,
    enabled,
    queryFn: () => adminRolesApi.list(),
    retry: false,
  })
  return enabled ? (roles.data ?? []).map((r) => ({ value: r.name, label: r.name })) : []
}
