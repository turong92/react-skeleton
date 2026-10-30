import type { ApiClient, ApiCursorResponse } from '@skeleton/api-client'
import type { AdminWorkspaceDetail, AdminWorkspaceQuery, AdminWorkspaceRow } from './types'

export type WorkspaceAdminApi = {
  /** `GET /admin/workspaces?q&cursor&size` (`workspace.read`) — 이름 · 주소 이름 검색, 커서 */
  list(query?: AdminWorkspaceQuery): Promise<ApiCursorResponse<AdminWorkspaceRow>>
  /** `GET /admin/workspaces/{id}` — 읽기만 */
  get(id: string): Promise<AdminWorkspaceDetail>
}

/** 운영 화면이 부르는 호출 모음 — 모듈이 `skeleton.workspace.admin.enabled=true` 일 때만 열린다(꺼져 있으면 404). 읽기만 있다 */
export function createWorkspaceAdminApi(
  client: Pick<ApiClient, 'value' | 'cursor'>,
  { basePath = '/admin/workspaces' }: { basePath?: string } = {},
): WorkspaceAdminApi {
  const base = basePath.replace(/\/+$/, '')
  return {
    list: ({ q, cursor, size } = {}) =>
      client.cursor<AdminWorkspaceRow>(base, {
        params: {
          ...(q !== undefined ? { q } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
          ...(size !== undefined ? { size } : {}),
        },
      }),
    get: (id) => client.value<AdminWorkspaceDetail>(`${base}/${encodeURIComponent(id)}`),
  }
}
