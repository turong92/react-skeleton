import type { QueryKey } from '@tanstack/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthorProfileApi } from './authorProfileApi'
import { createProfileMutation, removeProfileMutation, renameProfileMutation } from './mutations'
import { configQuery, listQuery } from './queries'

const MINUTES = 60_000

/** 내 살아 있는 프로필 목록 */
export function useAuthorProfiles(api: AuthorProfileApi) {
  return useQuery(listQuery(api))
}

/** 상한 · 이름 길이. 자주 바뀌지 않아 5분은 다시 가져오지 않는다 */
export function useAuthorProfileConfig(api: AuthorProfileApi) {
  return useQuery({ ...configQuery(api), staleTime: 5 * MINUTES })
}

export function useCreateAuthorProfile(api: AuthorProfileApi) {
  const client = useQueryClient()
  return useMutation(createProfileMutation(client, api))
}

/** `alsoInvalidate`: 작성자 이름이 걸린 다른 캐시(예: 게시판 `[['board']]`) */
export function useRenameAuthorProfile(
  api: AuthorProfileApi,
  alsoInvalidate?: readonly QueryKey[],
) {
  const client = useQueryClient()
  return useMutation(renameProfileMutation(client, api, alsoInvalidate))
}

export function useRemoveAuthorProfile(
  api: AuthorProfileApi,
  alsoInvalidate?: readonly QueryKey[],
) {
  const client = useQueryClient()
  return useMutation(removeProfileMutation(client, api, alsoInvalidate))
}
