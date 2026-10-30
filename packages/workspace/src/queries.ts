import { ApiRequestError } from '@skeleton/api-client'
import type { WorkspaceApi } from './workspaceApi'

/** 키는 `workspace` 한 뿌리 아래 — 변경이 이 접두어로 무효화한다 */
export const workspaceKeys = {
  all: ['workspace'] as const,
  list: () => [...workspaceKeys.all, 'list'] as const,
  bySlug: (slug: string) => [...workspaceKeys.all, 'by-slug', slug] as const,
  members: (id: string) => [...workspaceKeys.all, 'members', id] as const,
  invitations: (id: string) => [...workspaceKeys.all, 'invitations', id] as const,
  invitationPreview: (token: string) =>
    [...workspaceKeys.all, 'invitation-preview', token] as const,
}

/** 쿼리 정의(키 + 함수)를 훅과 따로 둔다 — 가짜 api 로 테스트하고 서버 렌더의 `prefetch` 에도 쓴다 */
export const listQuery = (api: Pick<WorkspaceApi, 'list'>) => ({
  queryKey: workspaceKeys.list(),
  queryFn: () => api.list(),
})

export const membersQuery = (api: Pick<WorkspaceApi, 'members'>, id: string) => ({
  queryKey: workspaceKeys.members(id),
  queryFn: () => api.members(id),
})

/** 404 는 없는 것 · 멤버 아닌 것 · 닫힌 것이 모두 같은 대답이라 다시 물어도 같다 — 그 밖의 실패만 두 번 더 */
export const shouldRetryResolve = (failureCount: number, error: unknown): boolean =>
  !(error instanceof ApiRequestError && error.apiError.status === 404) && failureCount < 2

/** 주소의 slug → 워크스페이스. 404 는 화면이 말하므로 전역 오류 토스트를 막는다(`quietStatuses`) */
export const bySlugQuery = (api: Pick<WorkspaceApi, 'bySlug'>, slug: string) => ({
  queryKey: workspaceKeys.bySlug(slug),
  queryFn: () => api.bySlug(slug),
  retry: shouldRetryResolve,
  meta: { quietStatuses: [404] },
})

export const invitationsQuery = (api: Pick<WorkspaceApi, 'invitations'>, id: string) => ({
  queryKey: workspaceKeys.invitations(id),
  queryFn: () => api.invitations(id),
})

/**
 * 초대 미리보기 — 죽은 토큰의 대답은 다시 물어도 같아서 다시 시도하지 않고, 400 은 화면이 문장으로 말하므로 전역 오류 토스트를 막는다.
 * 토큰은 이 키로 메모리에만 있다(저장소 · 주소에는 없다)
 */
export const invitationPreviewQuery = (
  api: Pick<WorkspaceApi, 'previewInvitation'>,
  token: string,
) => ({
  queryKey: workspaceKeys.invitationPreview(token),
  queryFn: () => api.previewInvitation(token),
  retry: false as const,
  meta: { quietStatuses: [400, 404] },
})
