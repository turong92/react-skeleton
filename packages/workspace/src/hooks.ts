import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acceptInvitationMutation,
  createWorkspaceMutation,
  inviteMutation,
  resendInvitationMutation,
  revokeInvitationMutation,
  leaveWorkspaceMutation,
  removeMemberMutation,
  setMemberRoleMutation,
  transferOwnershipMutation,
  updateWorkspaceMutation,
} from './mutations'
import {
  bySlugQuery,
  invitationPreviewQuery,
  invitationsQuery,
  listQuery,
  membersQuery,
} from './queries'
import type { WorkspaceApi } from './workspaceApi'

/** 내가 속한 워크스페이스 */
export function useWorkspaces(api: Pick<WorkspaceApi, 'list'>) {
  return useQuery(listQuery(api))
}

/** 주소의 slug 를 워크스페이스로 푼다(옛 slug 도) — 멤버 아니면 404 */
export function useWorkspaceBySlug(api: Pick<WorkspaceApi, 'bySlug'>, slug: string) {
  return useQuery(bySlugQuery(api, slug))
}

export function useWorkspaceMembers(api: Pick<WorkspaceApi, 'members'>, id: string) {
  return useQuery(membersQuery(api, id))
}

export function useCreateWorkspace(api: Pick<WorkspaceApi, 'create'>) {
  const client = useQueryClient()
  return useMutation(createWorkspaceMutation(client, api))
}

export function useUpdateWorkspace(api: Pick<WorkspaceApi, 'update'>, id: string) {
  const client = useQueryClient()
  return useMutation(updateWorkspaceMutation(client, api, id))
}

export function useSetMemberRole(api: Pick<WorkspaceApi, 'setMemberRole'>, id: string) {
  const client = useQueryClient()
  return useMutation(setMemberRoleMutation(client, api, id))
}

export function useRemoveMember(api: Pick<WorkspaceApi, 'removeMember'>, id: string) {
  const client = useQueryClient()
  return useMutation(removeMemberMutation(client, api, id))
}

export function useTransferOwnership(api: Pick<WorkspaceApi, 'transfer'>, id: string) {
  const client = useQueryClient()
  return useMutation(transferOwnershipMutation(client, api, id))
}

export function useLeaveWorkspace(api: Pick<WorkspaceApi, 'leave'>, id: string) {
  const client = useQueryClient()
  return useMutation(leaveWorkspaceMutation(client, api, id))
}

/** 대기 중인 초대(ADMIN 이상) */
export function useWorkspaceInvitations(api: Pick<WorkspaceApi, 'invitations'>, id: string) {
  return useQuery(invitationsQuery(api, id))
}

export function useInviteMembers(api: Pick<WorkspaceApi, 'invite'>, id: string) {
  const client = useQueryClient()
  return useMutation(inviteMutation(client, api, id))
}

export function useResendInvitation(api: Pick<WorkspaceApi, 'resendInvitation'>, id: string) {
  const client = useQueryClient()
  return useMutation(resendInvitationMutation(client, api, id))
}

export function useRevokeInvitation(api: Pick<WorkspaceApi, 'revokeInvitation'>, id: string) {
  const client = useQueryClient()
  return useMutation(revokeInvitationMutation(client, api, id))
}

/** 초대 미리보기 — 토큰을 읽기 전(`null`)에는 묻지 않는다 */
export function useInvitationPreview(
  api: Pick<WorkspaceApi, 'previewInvitation'>,
  token: string | null,
) {
  return useQuery({
    ...invitationPreviewQuery(api, token ?? ''),
    enabled: token !== null,
  })
}

export function useAcceptInvitation(api: Pick<WorkspaceApi, 'acceptInvitation'>) {
  const client = useQueryClient()
  return useMutation(acceptInvitationMutation(client, api))
}
