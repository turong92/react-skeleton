import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { WorkspaceAdminApi } from './adminApi'

/** 일반 화면의 `workspace` 뿌리와 따로 둔다 — 사용자의 변경이 운영 목록을 흔들지 않게 */
export const adminKeys = {
  all: ['workspace-admin'] as const,
  list: (q: string) => [...adminKeys.all, 'list', q] as const,
  detail: (id: string) => [...adminKeys.all, 'detail', id] as const,
}

/** 404 는 「서버에서 이 도구가 꺼져 있다」 — 화면이 제자리에서 말하니 전역 오류 토스트를 막는다(`meta.quietStatuses`) */
const LIST_OPTIONS = { retry: false, meta: { quietStatuses: [404] } } as const

/** 목록 — 커서로 이어 받는다. 검색어가 `''` 면 모두 */
export function useAdminWorkspaces(api: Pick<WorkspaceAdminApi, 'list'>, q = '', size = 20) {
  return useInfiniteQuery({
    queryKey: adminKeys.list(q),
    queryFn: ({ pageParam }) =>
      api.list({
        size,
        ...(q !== '' ? { q } : {}),
        ...(pageParam !== undefined ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.cursor.hasNext ? (last.cursor.nextCursor ?? undefined) : undefined,
    placeholderData: keepPreviousData,
    ...LIST_OPTIONS,
  })
}

/** 상세 — `id` 가 `null` 이면 묻지 않는다 */
export function useAdminWorkspace(api: Pick<WorkspaceAdminApi, 'get'>, id: string | null) {
  return useQuery({
    queryKey: adminKeys.detail(id ?? ''),
    queryFn: () => api.get(id ?? ''),
    enabled: id !== null,
    ...LIST_OPTIONS,
  })
}
