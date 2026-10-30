import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWorkspaceMutation,
  leaveWorkspaceMutation,
  removeMemberMutation,
  setMemberRoleMutation,
  transferOwnershipMutation,
  updateWorkspaceMutation,
} from './mutations'
import { bySlugQuery, listQuery, membersQuery } from './queries'
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
