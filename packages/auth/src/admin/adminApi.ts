import type { ApiClient, ApiPageResponse } from '@skeleton/api-client'
import type { AccountStatus, AdminAccount } from '../account/types'

export type AdminAccountQuery = {
  email?: string
  status?: AccountStatus
  page?: number
  size?: number
}

export type AdminAccountsApi = {
  list(query?: AdminAccountQuery): Promise<ApiPageResponse<AdminAccount>>
  get(id: string): Promise<AdminAccount>
  suspend(id: string, reason?: string): Promise<void>
  unsuspend(id: string): Promise<void>
  /** 삭제 유예 기간 안의 계정 되살리기 */
  restore(id: string): Promise<void>
  grantRole(id: string, role: string): Promise<void>
  revokeRole(id: string, role: string): Promise<void>
}

const seg = encodeURIComponent

/** 운영자 계정 도구(`/admin/accounts` — 백엔드 `skeleton.account.admin.enabled=true` 일 때만 열린다, ADMIN 역할 필요) */
export function createAdminAccountsApi(
  client: Pick<ApiClient, 'page' | 'value' | 'noContent'>,
): AdminAccountsApi {
  const post = (path: string, json: unknown = {}) =>
    client.noContent(path, { method: 'POST', json })
  return {
    list: (query = {}) =>
      client.page<AdminAccount>('/admin/accounts', {
        params: Object.fromEntries(
          Object.entries(query).filter(([, v]) => v !== undefined && v !== ''),
        ),
      }),
    get: (id) => client.value(`/admin/accounts/${seg(id)}`),
    suspend: (id, reason) => post(`/admin/accounts/${seg(id)}/suspend`, reason ? { reason } : {}),
    unsuspend: (id) => post(`/admin/accounts/${seg(id)}/unsuspend`),
    restore: (id) => post(`/admin/accounts/${seg(id)}/restore`),
    grantRole: (id, role) =>
      client.noContent(`/admin/accounts/${seg(id)}/roles/${seg(role)}`, { method: 'PUT' }),
    revokeRole: (id, role) =>
      client.noContent(`/admin/accounts/${seg(id)}/roles/${seg(role)}`, { method: 'DELETE' }),
  }
}
