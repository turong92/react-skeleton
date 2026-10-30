import type { ApiCursorResponse } from '@skeleton/api-client'
import type { AdminApiKeysApi } from '../admin/adminApiKeysApi'
import type { ApiKeysApi } from '../apiKeys/apiKeysApi'
import type { AdminApiKey, ApiKey } from '../apiKeys/types'
import { apiError } from '../test/apiFixtures'

/** 스토리의 다시 인증 비밀번호 */
export const FAKE_KEY_PASSWORD = 'old-password-1'
export const FAKE_KEY_TOKEN = 'notes_Zt3kQ9mWv2LxA7pRbN4cHs8Ye6UdGf1J'

export const FAKE_KEY_SCOPES = [
  { key: 'notes.read', module: 'notes' },
  { key: 'notes.write', module: 'notes' },
]
export const FAKE_SCOPE_LABELS = { 'notes.read': '노트 읽기', 'notes.write': '노트 쓰기' }

const base = (over: Partial<ApiKey> & Pick<ApiKey, 'id' | 'name'>): ApiKey => ({
  hint: 'f1J',
  scopes: ['notes.read'],
  status: 'ACTIVE',
  revokedBy: null,
  createdAt: '2026-09-01T00:00:00Z',
  expiresAt: null,
  lastUsedAt: null,
  ...over,
})

export const fakeKeys = (): ApiKey[] => [
  base({
    id: 'key_1',
    name: 'CI 서버',
    lastUsedAt: '2026-10-30T00:00:00Z',
    expiresAt: '2027-09-01T00:00:00Z',
  }),
  base({ id: 'key_2', name: '지난 실험', status: 'EXPIRED', expiresAt: '2026-10-01T00:00:00Z' }),
  base({ id: 'key_3', name: '유출된 키', status: 'REVOKED', revokedBy: 'OPERATOR' }),
  base({ id: 'key_4', name: '내가 끈 키', status: 'REVOKED', revokedBy: 'USER' }),
]

/** 메모리 가짜 - 발급은 다시 인증(비밀번호)을 검사하고, 활성 키 `limit` 개를 넘으면 409 `API_KEY.LIMIT_REACHED` */
export function createFakeApiKeysApi({
  keys = fakeKeys(),
  limit = 10,
}: { keys?: ApiKey[]; limit?: number } = {}) {
  let rows = keys.map((k) => ({ ...k }))
  const created: unknown[] = []
  const api: ApiKeysApi = {
    list: async () => rows.map((k) => ({ ...k })),
    scopes: async () => FAKE_KEY_SCOPES,
    create: async (input) => {
      created.push(input)
      if (input.currentPassword !== FAKE_KEY_PASSWORD)
        throw apiError('ACCOUNT.CURRENT_PASSWORD_INVALID', 400)
      if (rows.filter((k) => k.status === 'ACTIVE').length >= limit)
        throw apiError('API_KEY.LIMIT_REACHED', 409)
      const key = base({
        id: `key_${rows.length + 1}`,
        name: input.name,
        scopes: input.scopes,
        expiresAt: input.expiresAt ?? null,
      })
      rows = [key, ...rows]
      return { key, token: FAKE_KEY_TOKEN }
    },
    revoke: async (id) => {
      const key = rows.find((k) => k.id === id)
      if (!key) throw apiError('COMMON.NOT_FOUND', 404)
      key.status = 'REVOKED'
      key.revokedBy = 'USER'
    },
  }
  return { api, created: () => created }
}

const owned = (key: ApiKey, ownerId: string, ownerName?: string): AdminApiKey => ({
  ...key,
  ownerId,
  ownerName,
})

/** 운영자 가짜 - 쪽마다 두 줄, 상태 · 주인 필터, 사유 없는 회수는 400 */
export function createFakeAdminApiKeysApi() {
  let rows: AdminApiKey[] = [
    owned(fakeKeys()[0], 'acc_1', 'Ann'),
    owned(
      base({ id: 'key_a', name: '배치 작업', scopes: ['notes.read', 'notes.write'] }),
      'acc_2',
      'Bob',
    ),
    owned(fakeKeys()[2], 'acc_1', 'Ann'),
    owned(fakeKeys()[1], 'acc_2', 'Bob'),
  ]
  const revoked: { id: string; reason: string }[] = []
  const SIZE = 2
  const api: AdminApiKeysApi = {
    list: async ({ ownerId, status, cursor } = {}) => {
      const matching = rows.filter(
        (r) => (!ownerId || r.ownerId === ownerId) && (!status || r.status === status),
      )
      const from = cursor ? Number(cursor) : 0
      const values = matching.slice(from, from + SIZE)
      const hasNext = from + SIZE < matching.length
      return {
        values,
        cursor: { hasNext, nextCursor: hasNext ? String(from + SIZE) : null },
        meta: {},
      } as unknown as ApiCursorResponse<AdminApiKey>
    },
    revoke: async (id, reason) => {
      if (!reason.trim()) throw apiError('COMMON.VALIDATION_FAILED', 400)
      revoked.push({ id, reason })
      rows = rows.map((r) =>
        r.id === id ? { ...r, status: 'REVOKED', revokedBy: 'OPERATOR' as const } : r,
      )
    },
  }
  return { api, revoked: () => revoked }
}
