import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { ApiKeysApi } from './apiKeysApi'

export const apiKeyKeys = {
  all: ['auth', 'api-keys'] as const,
  list: () => [...apiKeyKeys.all, 'list'] as const,
  scopes: () => [...apiKeyKeys.all, 'scopes'] as const,
}

/** 내 키 목록 */
export function useApiKeys(api: Pick<ApiKeysApi, 'list'>) {
  // 도구가 꺼진 서버(404)는 재시도 없이 제자리 안내만 - 전역 오류 토스트가 한 번 더 말하지 않게 한다
  return useQuery({
    queryKey: apiKeyKeys.list(),
    queryFn: () => api.list(),
    retry: false,
    meta: { quietStatuses: [404] },
  })
}

/** 앱이 선언한 범위 - 거의 안 바뀌어 다시 가져오지 않는다 */
export function useApiKeyScopes(api: Pick<ApiKeysApi, 'scopes'>) {
  return useQuery({
    queryKey: apiKeyKeys.scopes(),
    queryFn: () => api.scopes(),
    staleTime: Infinity,
    retry: false,
    meta: { quietStatuses: [404] },
  })
}

/** 키 만들기 - 끝나면 목록을 다시 가져온다. 응답의 토큰은 호출자가 한 번 보여 주고 `reset()` 으로 버린다(캐시에 오래 두지 않는다) */
export function useCreateApiKey(api: Pick<ApiKeysApi, 'create'>) {
  return useMutation(createApiKeyOptions(api, useQueryClient()))
}

/**
 * 발급 뮤테이션의 설정. `gcTime: 0` - 결과(토큰)와 변수(다시 인증 비밀번호 · 코드)는 관찰자가 떨어지는 즉시 캐시에서 빠진다
 * (기본 5분 동안 `getMutationCache()` 에 남는다). 화면이 말하는 오류(400 · 404 · 409)는 앱의 전역 오류 토스트가 한 번 더 말하지 않게 한다
 */
export function createApiKeyOptions(api: Pick<ApiKeysApi, 'create'>, client: QueryClient) {
  return {
    mutationFn: (input: Parameters<ApiKeysApi['create']>[0]) => api.create(input),
    onSuccess: () => client.invalidateQueries({ queryKey: apiKeyKeys.list() }),
    gcTime: 0,
    meta: { quietStatuses: [400, 404, 409] },
  }
}

export function useRevokeApiKey(api: Pick<ApiKeysApi, 'revoke'>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.revoke(id),
    meta: { quietStatuses: [404] },
    // 이미 없는 키(404)여도 목록은 새로 가져온다
    onSettled: () => client.invalidateQueries({ queryKey: apiKeyKeys.list() }),
  })
}
