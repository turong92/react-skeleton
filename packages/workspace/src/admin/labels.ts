import type { WorkspaceRole } from '../types'
import type { AdminWorkspaceStatus } from './types'

export type WorkspaceAdminLabels = {
  loading: string
  loadFailed: string
  retry: string
  close: string
  /** 목록 호출이 404 — 서버에서 이 도구가 꺼져 있다 */
  notEnabled: string
  noPermission: string
  title: string
  searchLabel: string
  searchAction: string
  caption: string
  empty: string
  noOwner: string
  unnamedMember: string
  columns: {
    name: string
    owner: string
    members: string
    status: string
    created: string
    actions: string
  }
  status: Record<AdminWorkspaceStatus, string>
  roles: Record<WorkspaceRole, string>
  detail: string
  detailFor: (name: string) => string
  more: string
  detailTitle: (name: string) => string
  pending: (count: number) => string
  membersCaption: string
  memberColumns: { member: string; role: string; joined: string }
}

export { defaultWorkspaceAdminLabels } from './labels.en'
export { koWorkspaceAdminLabels } from './labels.ko'
