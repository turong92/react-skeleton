import type { AdminAccount } from '../account/types'

export type AdminRowAction = { kind: string; role?: string }

/**
 * 계정 상태별로 백엔드가 받는 명령 — 활성: 정지 · 역할 부여/회수, 정지: 해제, 삭제 유예 중: 복구.
 * `can` 을 주면 정지 · 해제 · 복구는 `account.manage`, 역할 부여/회수는 `account.roles` 가 있을 때만 낸다(안 주면 모두)
 */
export function rowActions(
  account: AdminAccount,
  assignableRoles: readonly string[],
  can: (key: string) => boolean = () => true,
): AdminRowAction[] {
  const manage = can('account.manage')
  if (account.status === 'DELETED') return manage ? [{ kind: 'restore' }] : []
  if (account.status === 'SUSPENDED') return manage ? [{ kind: 'unsuspend' }] : []
  return [
    ...(manage ? [{ kind: 'suspend' }] : []),
    ...(can('account.roles')
      ? assignableRoles.map((role) =>
          account.roles.includes(role)
            ? { kind: `revoke:${role}`, role }
            : { kind: `grant:${role}`, role },
        )
      : []),
  ]
}
