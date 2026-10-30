import type { InvitationRole, WorkspaceMember, WorkspaceRole } from './types'

const RANK: Record<WorkspaceRole, number> = { MEMBER: 0, ADMIN: 1, OWNER: 2 }

export const roleAtLeast = (role: WorkspaceRole, min: WorkspaceRole): boolean =>
  RANK[role] >= RANK[min]

/** 이름 · 주소 이름을 바꾸는 단추 — ADMIN 이상 (서버가 어차피 막는다. 화면은 단추를 숨길 뿐이다) */
export const canManageWorkspace = (role: WorkspaceRole): boolean => roleAtLeast(role, 'ADMIN')

export type MemberActions = { changeRole: boolean; remove: boolean; transfer: boolean }

/**
 * 멤버 표 한 줄에 보일 단추 — 내 줄과 소유자 줄에는 없다(탈퇴 · 이전은 따로).
 * 소유자: 누구의 역할이든 바꾸고 추방하고 소유권을 넘긴다. ADMIN: MEMBER 만 추방한다
 */
export function memberActions(
  viewerRole: WorkspaceRole,
  viewerAccountId: string,
  target: Pick<WorkspaceMember, 'accountId' | 'role'>,
): MemberActions {
  const none = { changeRole: false, remove: false, transfer: false }
  if (target.accountId === viewerAccountId || target.role === 'OWNER') return none
  if (viewerRole === 'OWNER') return { changeRole: true, remove: true, transfer: true }
  if (viewerRole === 'ADMIN' && target.role === 'MEMBER') return { ...none, remove: true }
  return none
}

/** 초대 보내기 · 대기 표 — ADMIN 이상 */
export const canInvite = (role: WorkspaceRole): boolean => roleAtLeast(role, 'ADMIN')

/** 내가 줄 수 있는 역할 — 소유자는 관리자도, 관리자는 멤버만. 소유자는 초대로 못 만든다 */
export function invitableRoles(role: WorkspaceRole): InvitationRole[] {
  if (role === 'OWNER') return ['MEMBER', 'ADMIN']
  if (role === 'ADMIN') return ['MEMBER']
  return []
}
