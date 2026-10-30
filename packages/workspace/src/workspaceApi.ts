import { newIdempotencyKey, type ApiClient } from '@skeleton/api-client'
import type {
  CreateWorkspaceInput,
  InvitationPreview,
  InviteInput,
  InviteResult,
  UpdateWorkspaceInput,
  WorkspaceDetail,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSummary,
} from './types'

type WorkspaceClient = Pick<ApiClient, 'value' | 'list' | 'noContent'>

export type WorkspaceApi = {
  /** `GET {base}` — 내가 속한 워크스페이스 */
  list(): Promise<WorkspaceSummary[]>
  /** `POST {base} { name, slug? }` — 201. 409 `WORKSPACE.SLUG_TAKEN` */
  create(
    input: CreateWorkspaceInput,
    options?: { idempotencyKey?: string },
  ): Promise<WorkspaceSummary>
  /** `GET {base}/{id}` — 멤버 아니면 404 `WORKSPACE.NOT_FOUND`(없는 것과 같다) */
  get(id: string): Promise<WorkspaceDetail>
  /** `GET {base}/by-slug/{slug}` — 지금 slug 든 옛 slug 든 풀어 준다. 받은 `slug` 가 주소와 다르면 주소를 바꾼다 */
  bySlug(slug: string): Promise<WorkspaceDetail>
  /** `PATCH {base}/{id} { name?, slug? }` — ADMIN 이상 */
  update(id: string, input: UpdateWorkspaceInput): Promise<WorkspaceDetail>
  /** `GET {base}/{id}/members` */
  members(id: string): Promise<WorkspaceMember[]>
  /** `PATCH {base}/{id}/members/{accountId} { role }` — 소유자만, ADMIN ↔ MEMBER */
  setMemberRole(id: string, accountId: string, role: Exclude<WorkspaceRole, 'OWNER'>): Promise<void>
  /** `DELETE {base}/{id}/members/{accountId}` — 추방. 소유자는 누구나(소유자 말고), ADMIN 은 MEMBER 만 */
  removeMember(id: string, accountId: string): Promise<void>
  /** `POST {base}/{id}/leave` — 소유자는 409 `WORKSPACE.OWNER_CANNOT_LEAVE`(먼저 이전) */
  leave(id: string): Promise<void>
  /** `POST {base}/{id}/transfer { accountId }` — 소유자만, 지금 멤버 하나에게 */
  transfer(id: string, accountId: string): Promise<void>
  /** `GET {base}/{id}/invitations` — 대기 중인 초대(ADMIN 이상) */
  invitations(id: string): Promise<WorkspaceInvitation[]>
  /** `POST {base}/{id}/invitations { emails(≤20), role }` — 주소마다 invited / alreadyInvited / seatLimited / alreadyMember */
  invite(id: string, input: InviteInput): Promise<InviteResult>
  /** `POST {base}/{id}/invitations/{invId}/resend` — 새 토큰(옛 링크 무효). 60초 안에 또 보내면 429 `WORKSPACE.RESEND_TOO_SOON` */
  resendInvitation(id: string, invitationId: string): Promise<void>
  /** `DELETE {base}/{id}/invitations/{invId}` — 취소 */
  revokeInvitation(id: string, invitationId: string): Promise<void>
  /** `POST {invitationsPath}/preview { token }` — 로그인 없이. 죽은 토큰은 400 `WORKSPACE.INVITATION_INVALID`(`reason`) */
  previewInvitation(token: string): Promise<InvitationPreview>
  /** `POST {invitationsPath}/accept { token }` — 로그인. 들어간 워크스페이스를 돌려준다(가정: 목록 한 줄과 같은 모양) */
  acceptInvitation(token: string): Promise<WorkspaceSummary>
}

export type WorkspaceApiOptions = {
  /** 컨트롤러 경로(기본 `/workspaces`, `/api/v1` 은 클라이언트의 baseUrl) */
  basePath?: string
  /** 미리보기 · 수락 경로(기본 `/workspace-invitations`) — 워크스페이스 id 없이 토큰으로 간다 */
  invitationsPath?: string
}

/**
 * 워크스페이스 HTTP 호출 모음. 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다.
 * 워크스페이스 자기 관리는 경로의 id 로 가므로 `X-Workspace-Id` 가 필요 없다 — 이 api 는 그 헤더를 붙이지 않는 클라이언트로 만든다(README).
 */
export function createWorkspaceApi(
  client: WorkspaceClient,
  {
    basePath = '/workspaces',
    invitationsPath = '/workspace-invitations',
  }: WorkspaceApiOptions = {},
): WorkspaceApi {
  const base = basePath.replace(/\/+$/, '')
  const tokenBase = invitationsPath.replace(/\/+$/, '')
  const one = (id: string) => `${base}/${encodeURIComponent(id)}`
  const member = (id: string, accountId: string) =>
    `${one(id)}/members/${encodeURIComponent(accountId)}`
  return {
    list: () => client.list<WorkspaceSummary>(base),
    create: (input, options) =>
      client.value<WorkspaceSummary>(base, {
        method: 'POST',
        json: input,
        idempotencyKey: options?.idempotencyKey ?? newIdempotencyKey(),
      }),
    get: (id) => client.value<WorkspaceDetail>(one(id)),
    bySlug: (slug) => client.value<WorkspaceDetail>(`${base}/by-slug/${encodeURIComponent(slug)}`),
    update: (id, input) => client.value<WorkspaceDetail>(one(id), { method: 'PATCH', json: input }),
    members: (id) => client.list<WorkspaceMember>(`${one(id)}/members`),
    setMemberRole: (id, accountId, role) =>
      client.noContent(member(id, accountId), { method: 'PATCH', json: { role } }),
    removeMember: (id, accountId) => client.noContent(member(id, accountId), { method: 'DELETE' }),
    leave: (id) => client.noContent(`${one(id)}/leave`, { method: 'POST' }),
    transfer: (id, accountId) =>
      client.noContent(`${one(id)}/transfer`, { method: 'POST', json: { accountId } }),
    invitations: (id) => client.list<WorkspaceInvitation>(`${one(id)}/invitations`),
    invite: async (id, input) => {
      const result = await client.value<InviteResult>(`${one(id)}/invitations`, {
        method: 'POST',
        json: input,
      })
      // 이 칸이 없는 옛 응답은 빈 배열로 읽는다
      return { ...result, alreadyMember: result.alreadyMember ?? [] }
    },
    resendInvitation: (id, invitationId) =>
      client.noContent(`${one(id)}/invitations/${encodeURIComponent(invitationId)}/resend`, {
        method: 'POST',
      }),
    revokeInvitation: (id, invitationId) =>
      client.noContent(`${one(id)}/invitations/${encodeURIComponent(invitationId)}`, {
        method: 'DELETE',
      }),
    // 토큰은 주소가 아니라 본문으로 — 접근 로그에 안 남게. 미리보기는 로그인 없이도 되므로 인증 헤더를 붙이지 않는다
    previewInvitation: (token) =>
      client.value<InvitationPreview>(`${tokenBase}/preview`, {
        method: 'POST',
        json: { token },
        skipAuth: true,
      }),
    acceptInvitation: (token) =>
      client.value<WorkspaceSummary>(`${tokenBase}/accept`, { method: 'POST', json: { token } }),
  }
}
