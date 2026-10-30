import type { ApiCursorResponse } from '@skeleton/api-client'
import type { WorkspaceAdminApi } from '../admin/adminApi'
import type { AdminWorkspaceDetail, AdminWorkspaceRow } from '../admin/types'
import type { WorkspaceMember } from '../types'

/** 스토리 · 시험용 메모리 안의 가짜 운영 서버 — 읽기만. 커서 페이지는 20개 */
const rows: AdminWorkspaceRow[] = [
  ['ws_1', 'Acme', 'acme', 'Olive', 4, 'ACTIVE'],
  ['ws_2', 'Globex', 'globex', 'Gina', 2, 'ACTIVE'],
  ['ws_3', 'Initech', 'initech', 'Ivy', 1, 'ACTIVE'],
  ['ws_4', 'Old Co', 'old-co', null, 1, 'CLOSED'],
  ...Array.from(
    { length: 22 },
    (_, i): [string, string, string, string | null, number, 'ACTIVE'] => [
      `ws_t${i}`,
      `Team ${String(i + 1).padStart(2, '0')}`,
      `team-${i + 1}`,
      `Owner ${i + 1}`,
      (i % 5) + 1,
      'ACTIVE',
    ],
  ),
].map(([id, name, slug, ownerLabel, memberCount, status]) => ({
  id: id as string,
  name: name as string,
  slug: slug as string,
  ownerLabel: ownerLabel as string | null,
  memberCount: memberCount as number,
  status: status as AdminWorkspaceRow['status'],
  createdAt: '2026-10-01T09:00:00Z',
}))

const PAGE = 20

export function createFakeWorkspaceAdmin(): { api: WorkspaceAdminApi } {
  const api: WorkspaceAdminApi = {
    list: async ({ q, cursor, size = PAGE } = {}) => {
      const needle = (q ?? '').trim().toLowerCase()
      const matching = rows.filter(
        (row) => !needle || row.name.toLowerCase().includes(needle) || row.slug.includes(needle),
      )
      const start = cursor ? Number(cursor) : 0
      const values = matching.slice(start, start + size)
      const hasNext = start + size < matching.length
      return {
        values,
        cursor: { hasNext, nextCursor: hasNext ? String(start + size) : null },
        meta: { timestamp: '2026-10-30T00:00:00Z' },
      } satisfies ApiCursorResponse<AdminWorkspaceRow>
    },
    get: async (id) => {
      const row = rows.find((r) => r.id === id)
      if (!row) throw new Error(`no workspace ${id}`)
      const members: WorkspaceMember[] = [
        {
          accountId: 'a1',
          label: row.ownerLabel ?? null,
          role: 'OWNER',
          joinedAt: '2026-10-01T09:00:00Z',
        },
        { accountId: 'a2', label: null, role: 'MEMBER', joinedAt: '2026-10-02T09:00:00Z' },
      ]
      return {
        ...row,
        pendingInvitations: row.id === 'ws_1' ? 2 : 0,
        members: members.slice(0, Math.max(1, row.memberCount)),
      } satisfies AdminWorkspaceDetail
    },
  }
  return { api }
}
