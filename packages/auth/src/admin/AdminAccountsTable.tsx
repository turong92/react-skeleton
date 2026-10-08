import {
  Alert,
  Badge,
  Button,
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

/** 표 위 검색 · 필터의 값. `loginId` 는 아이디를 켠 서버에서만 쓴다(비어 있으면 거르지 않는다) */
export type AdminAccountsQueryState = {
  email: string
  status: AccountStatus | ''
  loginId?: string
}

export type AdminAccountsTableProps = {
  accounts: AdminAccount[]
  pagination: PaginationMeta
  /** 운영자가 줄 수 있는 역할(예 `['ADMIN','MODERATOR']`) */
  assignableRoles: string[]
  query: AdminAccountsQueryState
  onQueryChange: (query: AdminAccountsQueryState) => void
  onPage: (page: number) => void
  onSuspend: (id: string, reason?: string) => Promise<unknown>
  onUnsuspend: (id: string) => Promise<unknown>
  onRestore: (id: string) => Promise<unknown>
  onGrantRole: (id: string, role: string) => Promise<unknown>
  onRevokeRole: (id: string, role: string) => Promise<unknown>
  formatDate?: (iso: string) => string
  /**
   * 「아이디」 열과 「아이디로 찾기」 칸을 그린다. 기본은 목록에 `loginId` 키가 하나라도 있는지(= 서버가 아이디를 켰는지) —
   * 정확히 일치하는 아이디를 찾다가 결과가 비면 키를 볼 줄이 없어 칸이 사라지므로, 목록을 부르는 화면(`AdminAccounts`)이 한 번 켜지면 계속 켠다
   */
  showLoginId?: boolean
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
  showLoginId: showLoginIdProp,
  labels: given,
}: AdminAccountsTableProps) {
  const labels = mergeLabels(given)
  const showLoginId = showLoginIdProp ?? accounts.some((a) => a.loginId !== undefined)
  const [suspending, setSuspending] = useState<AdminAccount | null>(null)
  const [reason, setReason] = useState('')
  /** 아이디 찾기 칸에 쓰는 중인 값 - 낼 때(Enter · 단추)만 `query.loginId` 가 된다 */
  const [idDraft, setIdDraft] = useState(query.loginId ?? '')
  // 밖에서 질의가 바뀌면(필터 초기화 · 주소로 들어온 검색) 초안도 따라간다 - 낡은 글자가 질의와 다르게 남지 않게. 질의가 그대로인 동안은 쓰는 중인 초안을 건드리지 않는다
  const [queriedId, setQueriedId] = useState(query.loginId ?? '')
  if ((query.loginId ?? '') !== queriedId) {
    setQueriedId(query.loginId ?? '')
    setIdDraft(query.loginId ?? '')
  }
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
        {showLoginId && (
          // 정확 일치라 입력 중에는 늘 빈 결과다 - 글자마다 묻지 않고 Enter 나 단추로 낸다(아이디 조각이 주소 · 로그에 남지 않는다)
          <form
            role="search"
            className={styles.row}
            onSubmit={(event) => {
              event.preventDefault()
              onQueryChange({ ...query, loginId: idDraft.trim() })
            }}
          >
            <Field label={labels.adminSearchLoginId}>
              {(control) => (
                <Input
                  {...control}
                  type="search"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={idDraft}
                  onChange={(e) => {
                    setIdDraft(e.target.value)
                    // 비우면 거름이 바로 풀린다(찾는 중이었을 때만)
                    if (e.target.value === '' && query.loginId)
                      onQueryChange({ ...query, loginId: '' })
                  }}
                />
              )}
            </Field>
            <Button type="submit" variant="secondary">
              {labels.adminFindLoginId}
            </Button>
          </form>
        )}
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
        // 쪽 제목(`AdminAccounts` 의 h1) 바로 아래라 h2 - 아이디 정확 일치는 결과가 비는 일이 흔하다
        empty={<EmptyState title={labels.adminEmpty} headingLevel={2} />}
        columns={[
          { key: 'email', header: labels.adminColumns.email, render: (a) => a.email ?? '-' },
          ...(showLoginId
            ? [
                {
                  key: 'loginId',
                  header: labels.loginId,
                  render: (a: AdminAccount) => a.loginId ?? '-',
                },
              ]
            : []),
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
        onClose={() => {
          setSuspending(null)
          setReason('') // 닫을 때 비운다 — 다음 계정 정지에 이전 사유가 채워지지 않게
        }}
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
