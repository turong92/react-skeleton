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
 * 계약 C4 + C-A(위계) 의 메모리 가짜 - 순환 409 · 모르는 포함 400 · 포함된 역할 삭제 409 · 같은 이름 409 · 전권 편집/삭제 409 · 가진 계정이 있으면 삭제 409 · 모르는 권한 400.
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
  /** 물려받은 것까지 편 권한 */
  const effective = (role: AdminRole, seen = new Set<string>()): string[] => {
    if (seen.has(role.name)) return []
    seen.add(role.name)
    const inherited = (role.includes ?? []).flatMap((n) => {
      const included = roles.find((r) => r.name === n)
      return included ? effective(included, seen) : []
    })
    return [...new Set([...role.permissions, ...inherited])]
  }
  const view = (role: AdminRole): AdminRole => ({
    ...role,
    includes: role.includes ?? [],
    effectivePermissions: effective(role),
  })
  const reaches = (from: string, target: string, seen = new Set<string>()): boolean => {
    if (from === target) return true
    if (seen.has(from)) return false
    seen.add(from)
    return (roles.find((r) => r.name === from)?.includes ?? []).some((n) =>
      reaches(n, target, seen),
    )
  }
  const checkIncludes = (name: string, includes: string[] | undefined) => {
    for (const n of includes ?? []) {
      if (!roles.some((r) => r.name === n)) throw fail('AUTHZ.INCLUDE_UNKNOWN', 400)
      if (reaches(n, name)) throw fail('AUTHZ.ROLE_CYCLE', 409)
    }
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
    list: async () => roles.map(view),
    create: async (input) => {
      guard()
      if (roles.some((r) => r.name === input.name)) throw fail('AUTHZ.ROLE_EXISTS', 409)
      checkPermissions(input.permissions)
      checkIncludes(input.name, input.includes)
      const role = { ...input, protected: false, holders: 0 }
      roles = [...roles, role]
      return view(role)
    },
    update: async (name, input) => {
      guard()
      const role = find(name)
      if (role.protected) throw fail('AUTHZ.ROLE_PROTECTED', 409)
      checkPermissions(input.permissions)
      checkIncludes(name, input.includes)
      const { includes, ...rest } = input
      Object.assign(role, rest)
      if (includes) role.includes = includes
      return view(role)
    },
    remove: async (name) => {
      guard()
      const role = find(name)
      if (role.protected) throw fail('AUTHZ.ROLE_PROTECTED', 409)
      if ((role.holders ?? 0) > 0) throw fail('AUTHZ.ROLE_IN_USE', 409)
      if (roles.some((r) => r.includes?.includes(name))) throw fail('AUTHZ.ROLE_INCLUDED', 409)
      roles = roles.filter((r) => r !== role)
    },
  }
  return api
}
