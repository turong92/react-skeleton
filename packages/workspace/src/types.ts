/** 고정 셋 — 소유자는 정확히 한 명(이전으로만 바뀐다) */
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER'

/** `GET /workspaces` 의 한 줄 — 내가 속한 워크스페이스와 내 역할 */
export type WorkspaceSummary = {
  id: string
  name: string
  /** 주소 `/w/<slug>/…` 에 쓰는 이름 */
  slug: string
  role: WorkspaceRole
}

/** `GET /workspaces/{id}` · `GET /workspaces/by-slug/{slug}` — `slug` 는 늘 지금 값(옛 slug 로 불러도) */
export type WorkspaceDetail = WorkspaceSummary & {
  memberCount: number
  pendingInvitations: number
  /** 좌석 상한 — 앱이 정한다(없으면 null · 생략) */
  seatLimit?: number | null
  createdAt: string
}

export type WorkspaceMember = {
  accountId: string
  /** 서버의 `AccountLabels` — 없으면 이름 없는 멤버로 그린다(계정 id 는 화면에 그리지 않는다) */
  label?: string | null
  role: WorkspaceRole
  joinedAt: string
}

/** 만들기 — `slug` 를 안 주면 서버가 이름에서 만든다 */
export type CreateWorkspaceInput = { name: string; slug?: string }

/** 고치기 — 바뀐 것만 보낸다 */
export type UpdateWorkspaceInput = { name?: string; slug?: string }

/** 초대할 때 줄 수 있는 역할 — 소유자는 초대로 못 만든다(이전으로만) */
export type InvitationRole = Exclude<WorkspaceRole, 'OWNER'>

/** `GET /workspaces/{id}/invitations` 의 한 줄 — 대기 중인 초대(토큰은 서버가 메일에만 싣는다) */
export type WorkspaceInvitation = {
  id: string
  email: string
  role: InvitationRole
  expiresAt: string
  /** 서버가 읽어 준 만료 여부 — 만료는 상태가 아니라 시각 비교다 */
  expired: boolean
  /** 보낸 횟수(처음 + 재발송) */
  sentCount: number
  /** 보낸 사람 — 화면에 그리지 않는다(계정 id 일 수 있다) */
  invitedBy?: string | null
}

/** 초대하기 — 한 번에 20개까지 */
export type InviteInput = { emails: string[]; role: InvitationRole }

/** 주소마다 어떻게 됐는지: 새로 보냄 · 이미 대기 중이라 건너뜀 · 좌석이 모자라 못 보냄 */
export type InviteResult = {
  invited: string[]
  alreadyInvited: string[]
  seatLimited: string[]
}

/** `POST /workspace-invitations/preview` — 로그인 없이 보이는 초대 안내(주소는 가려서) */
export type InvitationPreview = {
  workspaceName: string
  inviterLabel?: string | null
  emailMasked: string
  role: InvitationRole
  expiresAt: string
}
