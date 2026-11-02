import type { ApiClient, ApiPageResponse } from '@skeleton/api-client'
import type { AccountStatus, AdminAccount } from '../account/types'

export type AdminAccountQuery = {
  email?: string
  /** 로그인 아이디로 찾기 - **정확히 일치**만(조각 검색은 없다). 아이디를 켠 서버에서만 뜻이 있다 */
  loginId?: string
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
  /**
   * 2단계 인증 해제(`POST /admin/mfa/accounts/{id}/reset {reason}` → 204, 권한 `mfa.reset`) - 대상의 인증 앱 · 복구 코드가 죽고 모든 세션이 닫히며 본인에게 메일이 간다.
   * 사유는 필수 입력이다(서버는 대상 id 만 기록한다). 자기 자신 409 `MFA.SELF_RESET` · 권한 상승 403 `MFA.ESCALATION` · 꺼진 계정 409 `MFA.NOT_ENABLED`. 백엔드 `skeleton.auth-mfa.admin.enabled=true` 일 때만 열린다(꺼짐 404)
   */
  resetMfa(id: string, reason: string): Promise<void>
  /** 이 운영자가 줄 수 있는 역할(`account.roles`) - 역할 모듈(`authz`)이 없는 서버도 답한다. 전권 역할의 `permissions` 는 `['*']` */
  assignableRoles(): Promise<AssignableRole[]>
}

export type AssignableRole = { name: string; permissions: string[] }

const seg = encodeURIComponent

/** 백엔드가 받는 범위(`page >= 0`, `1 <= size <= 100` — 벗어나면 400)로 맞춘다 */
const clampPage = (page: number) => Math.max(0, Math.floor(page))
const clampSize = (size: number) => Math.min(100, Math.max(1, Math.floor(size)))

/** 운영자 계정 도구(`/admin/accounts` — 백엔드 `skeleton.account.admin.enabled=true` 일 때만 열린다, ADMIN 역할 필요) */
export function createAdminAccountsApi(
  client: Pick<ApiClient, 'page' | 'value' | 'noContent' | 'list'>,
): AdminAccountsApi {
  const post = (path: string, json: unknown = {}) =>
    client.noContent(path, { method: 'POST', json })
  return {
    assignableRoles: () => client.list<AssignableRole>('/admin/accounts/assignable-roles'),
    list: (query = {}) =>
      client.page<AdminAccount>('/admin/accounts', {
        params: Object.fromEntries(
          Object.entries({
            ...query,
            ...(query.page !== undefined ? { page: clampPage(query.page) } : {}),
            ...(query.size !== undefined ? { size: clampSize(query.size) } : {}),
          }).filter(([, v]) => v !== undefined && v !== ''),
        ),
      }),
    get: (id) => client.value(`/admin/accounts/${seg(id)}`),
    suspend: (id, reason) => post(`/admin/accounts/${seg(id)}/suspend`, reason ? { reason } : {}),
    resetMfa: (id, reason) => post(`/admin/mfa/accounts/${seg(id)}/reset`, { reason }),
    unsuspend: (id) => post(`/admin/accounts/${seg(id)}/unsuspend`),
    restore: (id) => post(`/admin/accounts/${seg(id)}/restore`),
    grantRole: (id, role) =>
      client.noContent(`/admin/accounts/${seg(id)}/roles/${seg(role)}`, { method: 'PUT' }),
    revokeRole: (id, role) =>
      client.noContent(`/admin/accounts/${seg(id)}/roles/${seg(role)}`, { method: 'DELETE' }),
  }
}
