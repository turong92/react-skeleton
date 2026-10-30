import type { WorkspaceMember } from '../types'

export type AdminWorkspaceStatus = 'ACTIVE' | 'CLOSED'

/** `GET /admin/workspaces` 의 한 줄 */
export type AdminWorkspaceRow = {
  id: string
  name: string
  slug: string
  /** 소유자 이름 — 서버가 `account.read` 권한이 있는 운영자에게만 준다(없거나 소유자가 없으면 null) */
  ownerLabel?: string | null
  memberCount: number
  status: AdminWorkspaceStatus
  createdAt: string
}

/** `GET /admin/workspaces/{id}` — 멤버 표 + 기다리는 초대 수 */
export type AdminWorkspaceDetail = AdminWorkspaceRow & {
  pendingInvitations: number
  members: WorkspaceMember[]
}

export type AdminWorkspaceQuery = { q?: string; cursor?: string; size?: number }
