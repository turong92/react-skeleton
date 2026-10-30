import type { ApiClient, ApiCursorResponse } from '@skeleton/api-client'
import type { AdminApiKey, ApiKeyStatus } from '../apiKeys/types'

export type AdminApiKeyQuery = {
  ownerId?: string
  status?: ApiKeyStatus
  cursor?: string
  size?: number
}

export type AdminApiKeysApi = {
  /** `GET /admin/api-keys?ownerId&status&cursor` (`api-key.read`) - 최신순 커서 */
  list(query?: AdminApiKeyQuery): Promise<ApiCursorResponse<AdminApiKey>>
  /** `POST /admin/api-keys/{id}/revoke {reason}` (`api-key.revoke`) - 사유 필수 */
  revoke(id: string, reason: string): Promise<void>
}

/** API 키 운영 도구(백엔드 `skeleton.api-key.admin.enabled=true` 일 때만 - 꺼져 있으면 404) */
export function createAdminApiKeysApi(
  client: Pick<ApiClient, 'cursor' | 'noContent'>,
): AdminApiKeysApi {
  return {
    list: ({ ownerId, status, cursor, size } = {}) =>
      client.cursor<AdminApiKey>('/admin/api-keys', {
        params: {
          ...(ownerId ? { ownerId } : {}),
          ...(status ? { status } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
          ...(size !== undefined ? { size } : {}),
        },
      }),
    revoke: (id, reason) =>
      client.noContent(`/admin/api-keys/${encodeURIComponent(id)}/revoke`, {
        method: 'POST',
        json: { reason },
      }),
  }
}
