import { ApiRequestError } from '@skeleton/api-client'
import { slugFromName } from '../slug'
import type { WorkspaceDetail, WorkspaceMember, WorkspaceRole, WorkspaceSummary } from '../types'
import type { WorkspaceApi } from '../workspaceApi'

/** 스토리 · 시험용 메모리 안의 가짜 워크스페이스 서버 — 내 계정은 `ME` */
export const ME = 'acc_me'

const fail = (status: number, code: string) =>
  new ApiRequestError({ code, title: code, status } as never, 'trace', 'span', 'parent')

type Team = {
  id: string
  name: string
  slug: string
  /** 옛 slug — 다른 팀이 가져가지 못하고, 풀면 지금 slug 로 이어진다 */
  retired: string[]
  members: WorkspaceMember[]
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
}

export function createFakeWorkspaces({ role = 'OWNER', oldSlug }: FakeWorkspacesOptions = {}) {
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
    },
    {
      id: 'ws_2',
      name: 'Globex',
      slug: 'globex',
      retired: [],
      members: [person('acc_gina', 'Gina', 'OWNER'), person(ME, 'You', 'MEMBER')],
    },
  ]
  let next = 3

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
    pendingInvitations: 0,
    seatLimit: null,
    createdAt: '2026-10-01T09:00:00Z',
  })
  const memberTeam = (id: string) => {
    const found = team(id)
    if (!mine(found)) throw fail(404, 'WORKSPACE.NOT_FOUND')
    return found
  }
  const slugUsedByOthers = (slug: string, self?: Team) =>
    teams.some((t) => t !== self && (t.slug === slug || t.retired.includes(slug)))

  const api: WorkspaceApi = {
    list: async () => teams.filter(mine).map(summary),
    create: async ({ name, slug }) => {
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
  }
  return { api }
}
