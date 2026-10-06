import {
  Alert,
  Badge,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Pagination,
  RowMenu,
  Select,
  Table,
} from '@skeleton/ui'
import type { PaginationMeta } from '@skeleton/api-client'
import { useState } from 'react'
import type { AccountStatus, AdminAccount } from '../account/types'
import styles from '../screens/auth.module.css'
import { mergeLabels, type AuthLabels } from '../screens/labels'
import { useAction } from '../screens/useAction'
import { rowActions } from './rowActions'

export type AdminAccountsTableProps = {
  accounts: AdminAccount[]
  pagination: PaginationMeta
  /** 운영자가 줄 수 있는 역할(예 `['ADMIN','MODERATOR']`) */
  assignableRoles: string[]
  query: { email: string; status: AccountStatus | '' }
  onQueryChange: (query: { email: string; status: AccountStatus | '' }) => void
  onPage: (page: number) => void
  onSuspend: (id: string, reason?: string) => Promise<unknown>
  onUnsuspend: (id: string) => Promise<unknown>
  onRestore: (id: string) => Promise<unknown>
  onGrantRole: (id: string, role: string) => Promise<unknown>
  onRevokeRole: (id: string, role: string) => Promise<unknown>
  formatDate?: (iso: string) => string
  labels?: Partial<AuthLabels>
}

const tone = (status: AccountStatus) =>
  status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' ? 'warning' : 'danger'
const defaultFormat = (iso: string) => new Date(iso).toLocaleDateString()

/** 운영자 계정 표 — 검색 · 상태 필터 · 쪽 이동 · 줄마다 ⋯ 메뉴(정지 · 해제 · 복구 · 역할). 선택 내보내기: `@skeleton/auth/admin` */
export function AdminAccountsTable({
  accounts,
  pagination,
  assignableRoles,
  query,
  onQueryChange,
  onPage,
  onSuspend,
  onUnsuspend,
  onRestore,
  onGrantRole,
  onRevokeRole,
  formatDate = defaultFormat,
  labels: given,
}: AdminAccountsTableProps) {
  const labels = mergeLabels(given)
  const [suspending, setSuspending] = useState<AdminAccount | null>(null)
  const [reason, setReason] = useState('')
  const action = useAction(labels)

  function items(account: AdminAccount) {
    return rowActions(account, assignableRoles).map((a) => ({
      key: a.kind,
      label:
        a.kind === 'suspend'
          ? labels.adminSuspend
          : a.kind === 'unsuspend'
            ? labels.adminUnsuspend
            : a.kind === 'restore'
              ? labels.adminRestore
              : a.kind.startsWith('grant')
                ? labels.adminGrantRole(a.role ?? '')
                : labels.adminRevokeRole(a.role ?? ''),
      danger: a.kind === 'suspend',
      onSelect: () => {
        if (a.kind === 'suspend') return setSuspending(account)
        if (a.kind === 'unsuspend') return void action.run(() => onUnsuspend(account.id))
        if (a.kind === 'restore') return void action.run(() => onRestore(account.id))
        if (a.role && a.kind.startsWith('grant'))
          return void action.run(() => onGrantRole(account.id, a.role!))
        if (a.role) return void action.run(() => onRevokeRole(account.id, a.role!))
      },
    }))
  }

  async function confirmSuspend() {
    if (!suspending) return
    await action.run(() => onSuspend(suspending.id, reason.trim() || undefined))
    setSuspending(null)
    setReason('')
  }

  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <Field label={labels.adminSearch}>
          {(control) => (
            <Input
              {...control}
              type="search"
              value={query.email}
              onChange={(e) => onQueryChange({ ...query, email: e.target.value })}
            />
          )}
        </Field>
        <Field label={labels.adminStatusFilter}>
          {(control) => (
            <Select
              {...control}
              value={query.status}
              onChange={(e) =>
                onQueryChange({ ...query, status: e.target.value as AccountStatus | '' })
              }
            >
              <option value="">{labels.adminStatusAll}</option>
              {['ACTIVE', 'SUSPENDED', 'DELETED'].map((status) => (
                <option key={status} value={status}>
                  {labels.adminStatus[status] ?? status}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {action.error && <Alert tone="danger">{action.error.message}</Alert>}
      <Table
        caption={labels.adminCaption}
        rows={accounts}
        rowKey={(a) => a.id}
        empty={<EmptyState title={labels.adminEmpty} />}
        columns={[
          { key: 'email', header: labels.adminColumns.email, render: (a) => a.email ?? '-' },
          { key: 'name', header: labels.adminColumns.name, render: (a) => a.displayName ?? '-' },
          {
            key: 'status',
            header: labels.adminColumns.status,
            render: (a) => (
              <span>
                <Badge tone={tone(a.status)}>{labels.adminStatus[a.status] ?? a.status}</Badge>
                {a.suspendedReason && <span className={styles.muted}> {a.suspendedReason}</span>}
                {a.purgeAfter && (
                  <span className={styles.muted}>
                    {' '}
                    {labels.adminPurgeAfter(formatDate(a.purgeAfter))}
                  </span>
                )}
              </span>
            ),
          },
          { key: 'roles', header: labels.adminColumns.roles, render: (a) => a.roles.join(', ') },
          {
            key: 'created',
            header: labels.adminColumns.created,
            render: (a) => formatDate(a.createdAt),
          },
          {
            key: 'lastLogin',
            header: labels.adminColumns.lastLogin,
            render: (a) => (a.lastLoginAt ? formatDate(a.lastLoginAt) : '-'),
          },
          {
            key: 'actions',
            header: labels.adminColumns.actions,
            render: (a) => <RowMenu label={`${a.email ?? a.id} ⋯`} items={items(a)} />,
          },
        ]}
      />
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={onPage}
        previousLabel={labels.adminPrevious}
        nextLabel={labels.adminNext}
      />
      <ConfirmDialog
        open={suspending !== null}
        onClose={() => setSuspending(null)}
        onConfirm={confirmSuspend}
        title={labels.adminSuspendTitle(suspending?.email ?? '')}
        description={
          <Field label={labels.adminSuspendReason}>
            {(control) => (
              <Input
                {...control}
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
        }
        confirmLabel={labels.adminSuspend}
        cancelLabel={labels.cancel}
        closeLabel={labels.cancel}
        busy={action.busy}
      />
    </div>
  )
}
