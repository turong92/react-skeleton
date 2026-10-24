import { ApiRequestError } from '@skeleton/api-client'
import type { AdminRole, AdminRolesApi, PermissionInfo } from '../admin/rolesApi'

const fail = (code: string, status: number) =>
  new ApiRequestError(
    { code, title: code, status, timestamp: 't', traceId: 'trace-r' },
    'trace-r',
    's',
    't',
  )

export const FAKE_PERMISSIONS: PermissionInfo[] = [
  { key: 'account.read', module: 'account' },
  { key: 'account.manage', module: 'account' },
  { key: 'account.roles', module: 'account' },
  { key: 'payment.read', module: 'payment' },
  { key: 'payment.refund', module: 'payment' },
  { key: 'payment.operate', module: 'payment' },
  { key: 'board.moderate', module: 'board' },
  { key: 'authz.roles', module: 'authz' },
]

export const fakeRoles = (): AdminRole[] => [
  { name: 'ADMIN', description: 'Full access', permissions: ['*'], protected: true, holders: 1 },
  {
    name: 'MODERATOR',
    description: 'Board moderators',
    permissions: ['board.moderate'],
    protected: false,
    holders: 2,
  },
  { name: 'EMPTY', description: '', permissions: [], protected: false, holders: 0 },
]

/**
 * 계약 C4 의 메모리 가짜 - 같은 이름 409 · 전권 편집/삭제 409 · 가진 계정이 있으면 삭제 409 · 모르는 권한 400.
 * `failNext(code, status)` 는 다음 변경 한 번을 그 오류로 실패시킨다(서버만 아는 규칙 - 권한 상승 · 자기 잠금 - 을 보여 줄 때)
 */
export function createFakeRolesApi(initial: AdminRole[] = fakeRoles()) {
  let roles = initial.map((r) => ({ ...r }))
  let next: { code: string; status: number } | null = null
  const known = new Set(FAKE_PERMISSIONS.map((p) => p.key))
  const guard = () => {
    if (!next) return
    const { code, status } = next
    next = null
    throw fail(code, status)
  }
  const find = (name: string) => {
    const role = roles.find((r) => r.name === name)
    if (!role) throw fail('AUTHZ.ROLE_NOT_FOUND', 404)
    return role
  }
  const checkPermissions = (keys: string[]) => {
    if (keys.includes('*')) throw fail('AUTHZ.ROLE_PROTECTED', 409)
    if (keys.some((k) => !known.has(k))) throw fail('AUTHZ.PERMISSION_UNKNOWN', 400)
  }
  const api: AdminRolesApi & {
    failNext(code: string, status: number): void
    roles(): AdminRole[]
  } = {
    failNext: (code, status) => {
      next = { code, status }
    },
    roles: () => roles,
    permissions: async () => FAKE_PERMISSIONS,
    list: async () => roles.map((r) => ({ ...r })),
    create: async (input) => {
      guard()
      if (roles.some((r) => r.name === input.name)) throw fail('AUTHZ.ROLE_EXISTS', 409)
      checkPermissions(input.permissions)
      const role = { ...input, protected: false, holders: 0 }
      roles = [...roles, role]
      return role
    },
    update: async (name, input) => {
      guard()
      const role = find(name)
      if (role.protected) throw fail('AUTHZ.ROLE_PROTECTED', 409)
      checkPermissions(input.permissions)
      Object.assign(role, input)
      return { ...role }
    },
    remove: async (name) => {
      guard()
      const role = find(name)
      if (role.protected) throw fail('AUTHZ.ROLE_PROTECTED', 409)
      if ((role.holders ?? 0) > 0) throw fail('AUTHZ.ROLE_IN_USE', 409)
      roles = roles.filter((r) => r !== role)
    },
  }
  return api
}
