import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiKeysApi } from './apiKeysApi'

export const apiKeyKeys = {
  all: ['auth', 'api-keys'] as const,
  list: () => [...apiKeyKeys.all, 'list'] as const,
  scopes: () => [...apiKeyKeys.all, 'scopes'] as const,
}

/** 내 키 목록 */
export function useApiKeys(api: Pick<ApiKeysApi, 'list'>) {
  return useQuery({ queryKey: apiKeyKeys.list(), queryFn: () => api.list() })
}

/** 앱이 선언한 범위 - 거의 안 바뀌어 다시 가져오지 않는다 */
export function useApiKeyScopes(api: Pick<ApiKeysApi, 'scopes'>) {
  return useQuery({
    queryKey: apiKeyKeys.scopes(),
    queryFn: () => api.scopes(),
    staleTime: Infinity,
  })
}

/** 키 만들기 - 끝나면 목록을 다시 가져온다. 응답의 토큰은 호출자가 한 번 보여 주고 `reset()` 으로 버린다(캐시에 오래 두지 않는다) */
export function useCreateApiKey(api: Pick<ApiKeysApi, 'create'>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<ApiKeysApi['create']>[0]) => api.create(input),
    onSuccess: () => client.invalidateQueries({ queryKey: apiKeyKeys.list() }),
  })
}

export function useRevokeApiKey(api: Pick<ApiKeysApi, 'revoke'>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.revoke(id),
    // 이미 없는 키(404)여도 목록은 새로 가져온다
    onSettled: () => client.invalidateQueries({ queryKey: apiKeyKeys.list() }),
  })
}
