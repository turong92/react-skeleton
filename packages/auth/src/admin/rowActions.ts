import type { AdminAccount } from '../account/types'
import type { AssignableRole } from './adminApi'

export type AdminRowAction = { kind: string; role?: string }

/** 역할 이름만 아는 줄(`string`)과 권한까지 아는 줄(`AssignableRole`) - 권한을 알아야 권한 상승을 화면에서 미리 거를 수 있다 */
export type RoleChoice = string | AssignableRole

const nameOf = (role: RoleChoice) => (typeof role === 'string' ? role : role.name)

/**
 * 계정 상태별로 백엔드가 받는 명령 — 활성: 정지 · 역할 부여/회수, 정지: 해제, 삭제 유예 중: 복구.
 * `can` 을 주면 정지 · 해제 · 복구는 `account.manage`, 역할 부여/회수는 `account.roles` 가 있을 때만 낸다(안 주면 모두).
 * `caller`(호출자의 권한 목록)를 주면 서버의 권한 상승 검사와 같게 거른다: 역할 부여/회수는 그 역할의 권한이 호출자 권한 안일 때만(전권 역할은 호출자가 `*` 일 때만),
 * 계정 상태 명령은 대상 계정이 가진 모든 역할의 권한이 호출자 권한 안일 때만. 목록에 없는 대상 역할은 판단할 수 없어 숨긴다(호출자가 `*` 이면 모두 통과). 안 주면 거르지 않는다
 */
export function rowActions(
  account: AdminAccount,
  assignableRoles: readonly RoleChoice[],
  can: (key: string) => boolean = () => true,
  caller?: readonly string[],
): AdminRowAction[] {
  const within = (permissions: readonly string[] | undefined) => {
    if (!caller || caller.includes('*')) return true
    if (!permissions || permissions.includes('*')) return false
    return permissions.every((p) => caller.includes(p))
  }
  const permissionsOf = (name: string) => {
    const found = assignableRoles.find((role) => nameOf(role) === name)
    return typeof found === 'object' ? found.permissions : undefined
  }
  const manage = can('account.manage') && account.roles.every((name) => within(permissionsOf(name)))
  if (account.status === 'DELETED') return manage ? [{ kind: 'restore' }] : []
  if (account.status === 'SUSPENDED') return manage ? [{ kind: 'unsuspend' }] : []
  return [
    ...(manage ? [{ kind: 'suspend' }] : []),
    ...(can('account.roles')
      ? assignableRoles
          .filter((role) => within(typeof role === 'object' ? role.permissions : undefined))
          .map(nameOf)
          .map((role) =>
            account.roles.includes(role)
              ? { kind: `revoke:${role}`, role }
              : { kind: `grant:${role}`, role },
          )
      : []),
  ]
}
