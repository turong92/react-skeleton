import type { MutationOptions, QueryClient } from '@tanstack/react-query'
import { workspaceKeys } from './queries'
import type {
  InviteInput,
  InviteResult,
  UpdateWorkspaceInput,
  WorkspaceDetail,
  WorkspaceRole,
  WorkspaceSummary,
} from './types'
import type { WorkspaceApi } from './workspaceApi'

/** 만들기 — 목록만 다시 가져온다 */
export function createWorkspaceMutation(
  client: QueryClient,
  api: Pick<WorkspaceApi, 'create'>,
): MutationOptions<
  WorkspaceSummary,
  Error,
  { name: string; slug?: string; idempotencyKey?: string }
> {
  return {
    mutationFn: ({ idempotencyKey, ...input }) => api.create(input, { idempotencyKey }),
    onSettled: () => client.invalidateQueries({ queryKey: workspaceKeys.list() }),
  }
}

/**
 * 이름 · 주소 이름 바꾸기 — 받은 상세를 **새 slug 의 캐시 자리**에 미리 넣는다.
 * 주소가 새 slug 로 바뀌면 Provider 가 그 키를 읽는데, 비어 있으면 화면이 잠깐 비었다 돌아온다
 */
export function updateWorkspaceMutation(
  client: QueryClient,
  api: Pick<WorkspaceApi, 'update'>,
  id: string,
): MutationOptions<WorkspaceDetail, Error, UpdateWorkspaceInput> {
  return {
    mutationFn: (input) => api.update(id, input),
    onSuccess: (updated) => {
      client.setQueryData(workspaceKeys.bySlug(updated.slug), updated)
    },
    onSettled: () => client.invalidateQueries({ queryKey: workspaceKeys.all }),
  }
}

const refreshAll = (client: QueryClient) => () =>
  client.invalidateQueries({ queryKey: workspaceKeys.all })

/** 멤버 수 · 역할이 바뀐다 — 워크스페이스 쪽 캐시 전부 */
export function setMemberRoleMutation(
  client: QueryClient,
  api: Pick<WorkspaceApi, 'setMemberRole'>,
  id: string,
): MutationOptions<void, Error, { accountId: string; role: Exclude<WorkspaceRole, 'OWNER'> }> {
  return {
    mutationFn: ({ accountId, role }) => api.setMemberRole(id, accountId, role),
    onSettled: refreshAll(client),
  }
}

export function removeMemberMutation(
  client: QueryClient,
  api: Pick<WorkspaceApi, 'removeMember'>,
  id: string,
): MutationOptions<void, Error, string> {
  return {
    mutationFn: (accountId) => api.removeMember(id, accountId),
    onSettled: refreshAll(client),
  }
}

/** 이전 — 나는 ADMIN 이 되고 새 소유자가 OWNER 가 된다 */
export function transferOwnershipMutation(
  client: QueryClient,
  api: Pick<WorkspaceApi, 'transfer'>,
  id: string,
): MutationOptions<void, Error, string> {
  return {
    mutationFn: (accountId) => api.transfer(id, accountId),
    onSettled: refreshAll(client),
  }
}

/**
 * 탈퇴 — 목록만 다시 가져온다. 이 워크스페이스의 캐시를 무효화하면 Provider 가 다시 풀다가 404 를 받아
 * 앱이 다른 곳으로 이동하기 전에 「찾을 수 없음」이 번쩍인다(이동은 부른 쪽이 `onLeft` 로 한다)
 */
export function leaveWorkspaceMutation(
  client: QueryClient,
  api: Pick<WorkspaceApi, 'leave'>,
  id: string,
): MutationOptions<void, Error, void> {
  return {
    mutationFn: () => api.leave(id),
    onSuccess: () => client.invalidateQueries({ queryKey: workspaceKeys.list() }),
  }
}

/** 초대 보내기 — 결과(보냄 · 이미 대기 · 좌석 모자람)는 부른 쪽이 받아 보여 준다. 대기 수 · 좌석이 바뀐다 */
export function inviteMutation(
  client: QueryClient,
  api: Pick<WorkspaceApi, 'invite'>,
  id: string,
): MutationOptions<InviteResult, Error, InviteInput> {
  return {
    mutationFn: (input) => api.invite(id, input),
    onSettled: refreshAll(client),
  }
}

export function resendInvitationMutation(
  client: QueryClient,
  api: Pick<WorkspaceApi, 'resendInvitation'>,
  id: string,
): MutationOptions<void, Error, string> {
  return {
    mutationFn: (invitationId) => api.resendInvitation(id, invitationId),
    onSettled: refreshAll(client),
  }
}

export function revokeInvitationMutation(
  client: QueryClient,
  api: Pick<WorkspaceApi, 'revokeInvitation'>,
  id: string,
): MutationOptions<void, Error, string> {
  return {
    mutationFn: (invitationId) => api.revokeInvitation(id, invitationId),
    onSettled: refreshAll(client),
  }
}

/** 수락 — 성공했을 때만 내 목록을 다시 가져온다(실패한 수락은 아무것도 바꾸지 않았다) */
export function acceptInvitationMutation(
  client: QueryClient,
  api: Pick<WorkspaceApi, 'acceptInvitation'>,
): MutationOptions<WorkspaceSummary, Error, string> {
  return {
    mutationFn: (token) => api.acceptInvitation(token),
    onSuccess: () => client.invalidateQueries({ queryKey: workspaceKeys.all }),
  }
}
