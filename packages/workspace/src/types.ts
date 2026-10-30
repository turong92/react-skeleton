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
