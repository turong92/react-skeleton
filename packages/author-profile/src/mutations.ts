import type { MutationOptions, QueryClient, QueryKey } from '@tanstack/react-query'
import type { AuthorProfileApi } from './authorProfileApi'
import { authorProfileKeys } from './queries'
import type { AuthorProfile } from './types'

/*
 * 프로필 변경의 「끝나면 무엇을 다시 가져오는가」 — 목록은 성공이든 실패든 다시 가져온다(상한 · 지워짐처럼 서버가 아는 사실이 화면과 어긋났을 수 있다).
 * 이름 바꾸기 · 지우기는 과거 글의 작성자 이름도 바꾼다(읽을 때 조회) — 그 글을 담은 캐시는 이 패키지가 모르므로 앱이 `alsoInvalidate` 로 알려 준다(예: `[['board']]`).
 */
const refresh = (client: QueryClient, alsoInvalidate: readonly QueryKey[]) => async () => {
  await client.invalidateQueries({ queryKey: authorProfileKeys.list() })
  for (const queryKey of alsoInvalidate) await client.invalidateQueries({ queryKey })
}

export function createProfileMutation(
  client: QueryClient,
  api: AuthorProfileApi,
): MutationOptions<AuthorProfile, Error, { name: string; idempotencyKey?: string }> {
  return {
    mutationFn: ({ name, idempotencyKey }) => api.create({ name }, { idempotencyKey }),
    onSettled: refresh(client, []),
  }
}

export function renameProfileMutation(
  client: QueryClient,
  api: AuthorProfileApi,
  alsoInvalidate: readonly QueryKey[] = [],
): MutationOptions<AuthorProfile, Error, { id: string; name: string }> {
  return {
    mutationFn: ({ id, name }) => api.rename(id, { name }),
    onSettled: refresh(client, alsoInvalidate),
  }
}

export function removeProfileMutation(
  client: QueryClient,
  api: AuthorProfileApi,
  alsoInvalidate: readonly QueryKey[] = [],
): MutationOptions<void, Error, string> {
  return {
    mutationFn: (id) => api.remove(id),
    onSettled: refresh(client, alsoInvalidate),
  }
}
