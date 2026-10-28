import type { ApiClient } from '@skeleton/api-client'

/** 권한 카탈로그 한 줄 - 붙은 모듈이 선언한 권한만 온다 */
export type PermissionInfo = { key: string; module: string }

/** 역할 한 줄. `protected` 는 전권 역할(고칠 수 없다), `holders` 는 가진 활성 계정 수(계정 모듈이 없으면 null) */
export type AdminRole = {
  name: string
  /** 서버가 null 을 줄 수 있다(설명 없이 만든 역할) */
  description: string | null
  permissions: string[]
  protected: boolean
  holders: number | null
  /** 이 역할이 통째로 포함하는 다른 역할들(위계). 위계 없는 서버는 안 준다 */
  includes?: string[]
  /** 물려받은 것까지 펼친 권한(서버가 계산). 위계 없는 서버는 안 준다 */
  effectivePermissions?: string[]
}

export type CreateRoleInput = {
  name: string
  description: string
  permissions: string[]
  includes?: string[]
}
/** `includes` 를 빼면 서버가 지금 값을 유지한다 */
export type UpdateRoleInput = { description: string; permissions: string[]; includes?: string[] }

export type AdminRolesApi = {
  permissions(): Promise<PermissionInfo[]>
  list(): Promise<AdminRole[]>
  create(input: CreateRoleInput): Promise<AdminRole>
  update(name: string, input: UpdateRoleInput): Promise<AdminRole>
  remove(name: string): Promise<void>
}

/** 역할 관리 도구(`/admin/roles` · `/admin/permissions` - 백엔드 `skeleton.authz.admin.enabled=true` 일 때만 열린다, `authz.roles` 권한) */
export function createAdminRolesApi(
  client: Pick<ApiClient, 'list' | 'value' | 'noContent'>,
): AdminRolesApi {
  const seg = encodeURIComponent
  return {
    permissions: () => client.list<PermissionInfo>('/admin/permissions'),
    list: () => client.list<AdminRole>('/admin/roles'),
    create: (input) => client.value<AdminRole>('/admin/roles', { method: 'POST', json: input }),
    update: (name, input) =>
      client.value<AdminRole>(`/admin/roles/${seg(name)}`, { method: 'PUT', json: input }),
    remove: (name) => client.noContent(`/admin/roles/${seg(name)}`, { method: 'DELETE' }),
  }
}
