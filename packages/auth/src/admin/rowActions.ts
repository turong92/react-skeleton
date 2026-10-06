import type { AdminAccount } from '../account/types'

export type AdminRowAction = { kind: string; role?: string }

/** 계정 상태별로 백엔드가 받는 명령 — 활성: 정지 · 역할 부여/회수, 정지: 해제, 삭제 유예 중: 복구 */
export function rowActions(
  account: AdminAccount,
  assignableRoles: readonly string[],
): AdminRowAction[] {
  if (account.status === 'DELETED') return [{ kind: 'restore' }]
  if (account.status === 'SUSPENDED') return [{ kind: 'unsuspend' }]
  return [
    { kind: 'suspend' },
    ...assignableRoles.map((role) =>
      account.roles.includes(role)
        ? { kind: `revoke:${role}`, role }
        : { kind: `grant:${role}`, role },
    ),
  ]
}
