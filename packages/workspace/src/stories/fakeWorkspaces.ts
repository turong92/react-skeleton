import { ApiRequestError } from '@skeleton/api-client'
import { slugFromName } from '../slug'
import type {
  InvitationPreview,
  InvitationRole,
  WorkspaceDetail,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSummary,
} from '../types'
import type { WorkspaceApi } from '../workspaceApi'

/** 스토리 · 시험용 메모리 안의 가짜 워크스페이스 서버 — 내 계정은 `ME` */
export const ME = 'acc_me'

const fail = (status: number, code: string, data?: unknown) =>
  new ApiRequestError({ code, title: code, status, data } as never, 'trace', 'span', 'parent')

/**
 * 스토리가 쓰는 초대 토큰 — 주소창에 `?token=` 으로 오는 값 대신 이 값을 탭 저장소에 넣어 둔다.
 * `ok` 는 내가 아직 멤버가 아닌 「Initech」로 가는 정상 초대
 */
export const FAKE_TOKENS = {
  ok: 'tok-ok',
  expired: 'tok-expired',
  used: 'tok-used',
  unknown: 'tok-unknown',
  mismatch: 'tok-mismatch',
  unverified: 'tok-unverified',
  member: 'tok-member',
  seat: 'tok-seat',
} as const

const PREVIEW: Record<string, InvitationPreview> = {
  [FAKE_TOKENS.ok]: preview('Initech', 'Ivy'),
  [FAKE_TOKENS.mismatch]: preview('Initech', 'Ivy'),
  [FAKE_TOKENS.unverified]: preview('Initech', 'Ivy'),
  [FAKE_TOKENS.member]: preview('Globex', 'Gina'),
  [FAKE_TOKENS.seat]: preview('Initech', 'Ivy'),
}

function preview(workspaceName: string, inviterLabel: string): InvitationPreview {
  return {
    workspaceName,
    inviterLabel,
    emailMasked: 'm***@example.com',
    role: 'MEMBER',
    expiresAt: '2026-11-06T09:00:00Z',
  }
}

type Team = {
  id: string
  name: string
  slug: string
  /** 옛 slug — 다른 팀이 가져가지 못하고, 풀면 지금 slug 로 이어진다 */
  retired: string[]
  members: WorkspaceMember[]
  invitations: WorkspaceInvitation[]
  seatLimit: number | null
}

const person = (accountId: string, label: string | null, role: WorkspaceRole): WorkspaceMember => ({
  accountId,
  label,
  role,
  joinedAt: '2026-10-02T09:00:00Z',
})

export type FakeWorkspacesOptions = {
  /** 「Acme」(ws_1)에서의 내 역할 — 기본 OWNER */
  role?: WorkspaceRole
  /** 「Acme」가 예전에 쓰던 주소 이름 — 옛 주소로 들어오는 사람을 시험한다 */
  oldSlug?: string
  /** 「Acme」의 좌석 상한(멤버 + 기다리는 초대) — 기본 없음 */
  seatLimit?: number | null
  /** 「Acme」에 기다리는 초대를 미리 둔다(기본: 살아 있는 하나 + 만료된 하나) */
  invitations?: WorkspaceInvitation[]
  /** 만들기 · 고치기 · 역할 바꾸기 · 나가기가 서버 오류(500, 참조 번호 포함)로 끝난다 — 실패 상태 스토리용 */
  breakWrites?: boolean
}

const pendingInvitation = (over: Partial<WorkspaceInvitation>): WorkspaceInvitation => ({
  id: 'wsi_live',
  email: 'live@example.com',
  role: 'MEMBER',
  expiresAt: '2026-11-06T09:00:00Z',
  expired: false,
  sentCount: 1,
  invitedBy: 'acc_olive',
  ...over,
})

export function createFakeWorkspaces({
  role = 'OWNER',
  oldSlug,
  seatLimit = null,
  breakWrites = false,
  invitations = [
    pendingInvitation({}),
    pendingInvitation({ id: 'wsi_old', email: 'old@example.com', expired: true, sentCount: 2 }),
  ],
}: FakeWorkspacesOptions = {}) {
  const teams: Team[] = [
    {
      id: 'ws_1',
      name: 'Acme',
      slug: 'acme',
      retired: oldSlug ? [oldSlug] : [],
      members: [
        person(role === 'OWNER' ? ME : 'acc_olive', role === 'OWNER' ? 'You' : 'Olive', 'OWNER'),
        person(role === 'ADMIN' ? ME : 'acc_adam', role === 'ADMIN' ? 'You' : 'Adam', 'ADMIN'),
        person(role === 'MEMBER' ? ME : 'acc_ann', role === 'MEMBER' ? 'You' : 'Ann', 'MEMBER'),
        person('acc_bo', 'Bo', 'MEMBER'),
        person('acc_nameless', null, 'MEMBER'),
      ],
      invitations: invitations.map((i) => ({ ...i })),
      seatLimit,
    },
    {
      id: 'ws_2',
      name: 'Globex',
      slug: 'globex',
      retired: [],
      members: [person('acc_gina', 'Gina', 'OWNER'), person(ME, 'You', 'MEMBER')],
      invitations: [],
      seatLimit: null,
    },
    // 내가 아직 멤버가 아닌 팀 — 초대를 수락하면 들어간다
    {
      id: 'ws_initech',
      name: 'Initech',
      slug: 'initech',
      retired: [],
      members: [person('acc_ivy', 'Ivy', 'OWNER')],
      invitations: [],
      seatLimit: 5,
    },
  ]
  let next = 3
  let nextInvitation = 1
  /** 방금 보낸 초대 — 60초 안에는 다시 못 보낸다(서버와 같다) */
  const justSent = new Set<string>()

  const team = (id: string) => {
    const found = teams.find((t) => t.id === id)
    if (!found) throw fail(404, 'WORKSPACE.NOT_FOUND')
    return found
  }
  const mine = (t: Team) => t.members.find((m) => m.accountId === ME)
  const summary = (t: Team): WorkspaceSummary => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    role: mine(t)?.role ?? 'MEMBER',
  })
  const detail = (t: Team): WorkspaceDetail => ({
    ...summary(t),
    memberCount: t.members.length,
    pendingInvitations: t.invitations.filter((i) => !i.expired).length,
    seatLimit: t.seatLimit,
    createdAt: '2026-10-01T09:00:00Z',
  })
  const memberTeam = (id: string) => {
    const found = team(id)
    if (!mine(found)) throw fail(404, 'WORKSPACE.NOT_FOUND')
    return found
  }
  const slugUsedByOthers = (slug: string, self?: Team) =>
    teams.some((t) => t !== self && (t.slug === slug || t.retired.includes(slug)))

  const broken = () => {
    if (breakWrites) throw fail(500, 'COMMON.INTERNAL_SERVER_ERROR')
  }

  const api: WorkspaceApi = {
    list: async () => teams.filter(mine).map(summary),
    create: async ({ name, slug }) => {
      broken()
      if (slug && slugUsedByOthers(slug)) throw fail(409, 'WORKSPACE.SLUG_TAKEN')
      let chosen = slug ?? (slugFromName(name) || 'team')
      for (let n = 2; !slug && slugUsedByOthers(chosen); n += 1)
        chosen = `${slugFromName(name) || 'team'}-${n}`
      const made: Team = {
        id: `ws_${next++}`,
        name,
        slug: chosen,
        retired: [],
        members: [person(ME, 'You', 'OWNER')],
        invitations: [],
        seatLimit: null,
      }
      teams.push(made)
      return summary(made)
    },
    get: async (id) => detail(memberTeam(id)),
    bySlug: async (slug) => {
      const found = teams.find((t) => (t.slug === slug || t.retired.includes(slug)) && mine(t))
      if (!found) throw fail(404, 'WORKSPACE.NOT_FOUND')
      return detail(found)
    },
    update: async (id, { name, slug }) => {
      broken()
      const t = memberTeam(id)
      if (mine(t)?.role === 'MEMBER') throw fail(403, 'WORKSPACE.FORBIDDEN')
      if (slug !== undefined && slug !== t.slug) {
        if (slugUsedByOthers(slug, t)) throw fail(409, 'WORKSPACE.SLUG_TAKEN')
        t.retired = t.retired.filter((old) => old !== slug)
        t.retired.push(t.slug)
        t.slug = slug
      }
      if (name !== undefined) t.name = name
      return detail(t)
    },
    members: async (id) => memberTeam(id).members.map((m) => ({ ...m })),
    setMemberRole: async (id, accountId, newRole) => {
      broken()
      const target = memberTeam(id).members.find((m) => m.accountId === accountId)
      if (!target) throw fail(404, 'WORKSPACE.MEMBER_NOT_FOUND')
      target.role = newRole
    },
    removeMember: async (id, accountId) => {
      const t = memberTeam(id)
      if (!t.members.some((m) => m.accountId === accountId))
        throw fail(404, 'WORKSPACE.MEMBER_NOT_FOUND')
      t.members = t.members.filter((m) => m.accountId !== accountId)
    },
    leave: async (id) => {
      broken()
      const t = memberTeam(id)
      if (mine(t)?.role === 'OWNER') throw fail(409, 'WORKSPACE.OWNER_CANNOT_LEAVE')
      t.members = t.members.filter((m) => m.accountId !== ME)
    },
    transfer: async (id, accountId) => {
      const t = memberTeam(id)
      const target = t.members.find((m) => m.accountId === accountId)
      if (!target) throw fail(404, 'WORKSPACE.MEMBER_NOT_FOUND')
      for (const m of t.members) if (m.role === 'OWNER') m.role = 'ADMIN'
      target.role = 'OWNER'
    },
    invitations: async (id) => {
      const t = memberTeam(id)
      if (mine(t)?.role === 'MEMBER') throw fail(403, 'WORKSPACE.FORBIDDEN')
      return t.invitations.map((i) => ({ ...i }))
    },
    invite: async (id, { emails, role: asRole }) => {
      const t = memberTeam(id)
      const myRole = mine(t)?.role
      if (myRole === 'MEMBER' || (myRole === 'ADMIN' && (asRole as InvitationRole) !== 'MEMBER'))
        throw fail(403, 'WORKSPACE.FORBIDDEN')
      const out = {
        invited: [] as string[],
        alreadyInvited: [] as string[],
        seatLimited: [] as string[],
      }
      for (const email of emails) {
        if (t.invitations.some((i) => i.email === email)) {
          out.alreadyInvited.push(email)
          continue
        }
        const live = t.invitations.filter((i) => !i.expired).length
        if (t.seatLimit !== null && t.members.length + live >= t.seatLimit) {
          out.seatLimited.push(email)
          continue
        }
        const made = pendingInvitation({
          id: `wsi_${nextInvitation++}`,
          email,
          role: asRole,
          invitedBy: ME,
        })
        t.invitations.push(made)
        justSent.add(made.id)
        out.invited.push(email)
      }
      return out
    },
    resendInvitation: async (id, invitationId) => {
      const t = memberTeam(id)
      const found = t.invitations.find((i) => i.id === invitationId)
      if (!found) throw fail(404, 'WORKSPACE.NOT_FOUND')
      if (justSent.has(found.id))
        throw fail(429, 'WORKSPACE.RESEND_TOO_SOON', { retryAfterSeconds: 42 })
      justSent.add(found.id)
      found.expired = false
      found.sentCount += 1
    },
    revokeInvitation: async (id, invitationId) => {
      const t = memberTeam(id)
      if (!t.invitations.some((i) => i.id === invitationId)) throw fail(404, 'WORKSPACE.NOT_FOUND')
      t.invitations = t.invitations.filter((i) => i.id !== invitationId)
    },
    previewInvitation: async (token) => {
      if (token === FAKE_TOKENS.expired)
        throw fail(400, 'WORKSPACE.INVITATION_INVALID', { reason: 'EXPIRED' })
      if (token === FAKE_TOKENS.used)
        throw fail(400, 'WORKSPACE.INVITATION_INVALID', { reason: 'USED' })
      const found = PREVIEW[token]
      if (!found) throw fail(400, 'WORKSPACE.INVITATION_INVALID', { reason: 'INVALID' })
      return { ...found }
    },
    acceptInvitation: async (token) => {
      if (token === FAKE_TOKENS.mismatch) throw fail(403, 'WORKSPACE.INVITATION_EMAIL_MISMATCH')
      if (token === FAKE_TOKENS.unverified) throw fail(403, 'WORKSPACE.EMAIL_UNVERIFIED')
      if (token === FAKE_TOKENS.member)
        throw fail(409, 'WORKSPACE.ALREADY_MEMBER', { id: 'ws_1', slug: 'acme' })
      if (token === FAKE_TOKENS.seat) throw fail(409, 'WORKSPACE.SEAT_LIMIT')
      if (token !== FAKE_TOKENS.ok)
        throw fail(400, 'WORKSPACE.INVITATION_INVALID', { reason: 'INVALID' })
      const initech = team('ws_initech')
      if (!mine(initech)) initech.members.push(person(ME, 'You', 'MEMBER'))
      return summary(initech)
    },
  }
  return { api }
}
