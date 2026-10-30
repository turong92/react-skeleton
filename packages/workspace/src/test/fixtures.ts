import type { WorkspaceApi } from '../workspaceApi'
import type { WorkspaceDetail, WorkspaceMember, WorkspaceSummary } from '../types'

export const summary = (over: Partial<WorkspaceSummary> = {}): WorkspaceSummary => ({
  id: 'ws_1',
  name: 'Acme',
  slug: 'acme',
  role: 'OWNER',
  ...over,
})

export const detail = (over: Partial<WorkspaceDetail> = {}): WorkspaceDetail => ({
  ...summary(),
  memberCount: 3,
  pendingInvitations: 1,
  seatLimit: null,
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
})

export const member = (over: Partial<WorkspaceMember> = {}): WorkspaceMember => ({
  accountId: 'acc_1',
  label: 'Ann',
  role: 'MEMBER',
  joinedAt: '2026-10-02T00:00:00Z',
  ...over,
})

/** 부르면 던지는 가짜 api — 시험이 쓰는 호출만 덮어쓴다 */
export function stubApi(over: Partial<WorkspaceApi> = {}): WorkspaceApi {
  const unused = async (): Promise<never> => {
    throw new Error('not stubbed')
  }
  return {
    list: unused,
    create: unused,
    get: unused,
    bySlug: unused,
    update: unused,
    members: unused,
    setMemberRole: unused,
    removeMember: unused,
    leave: unused,
    transfer: unused,
    ...over,
  }
}
