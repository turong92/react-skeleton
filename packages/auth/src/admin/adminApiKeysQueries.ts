import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { ApiKeyStatus } from '../apiKeys/types'
import type { AdminApiKeysApi } from './adminApiKeysApi'

export const adminApiKeyKeys = {
  all: ['auth', 'admin', 'api-keys'] as const,
  list: (ownerId: string, status: string) =>
    [...adminApiKeyKeys.all, 'list', ownerId, status] as const,
}

/** 전체 키 - 최신순 커서로 이어 받는다. 필터가 `''` 면 모두 */
export function useAdminApiKeys(
  api: Pick<AdminApiKeysApi, 'list'>,
  { ownerId = '', status = '' }: { ownerId?: string; status?: ApiKeyStatus | '' } = {},
  size = 20,
) {
  return useInfiniteQuery({
    queryKey: adminApiKeyKeys.list(ownerId, status),
    queryFn: ({ pageParam }) =>
      api.list({
        size,
        ...(ownerId !== '' ? { ownerId } : {}),
        ...(status !== '' ? { status } : {}),
        ...(pageParam !== undefined ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.cursor.hasNext ? (last.cursor.nextCursor ?? undefined) : undefined,
    placeholderData: keepPreviousData,
  })
}

export function useRevokeAdminApiKey(api: Pick<AdminApiKeysApi, 'revoke'>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.revoke(id, reason),
    onSettled: () => client.invalidateQueries({ queryKey: adminApiKeyKeys.all }),
  })
}
