import { ApiRequestError } from '@skeleton/api-client'
import { formatInstant } from '@skeleton/time'
import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Table,
  type TableColumn,
} from '@skeleton/ui'
import { useMemo, useState, type FormEvent } from 'react'
import type { WorkspaceAdminApi } from './adminApi'
import { useAdminWorkspace, useAdminWorkspaces } from './hooks'
import { defaultWorkspaceAdminLabels, type WorkspaceAdminLabels } from './labels'
import { allowAll, WORKSPACE_PERMISSIONS, type CanFn } from './permissions'
import type { AdminWorkspaceRow } from './types'
import styles from './AdminWorkspaces.module.css'

export type AdminWorkspacesProps = {
  api: WorkspaceAdminApi
  /** 권한 질문 - 주지 않으면 모두 true. `workspace.read` 가 없으면 목록 대신 안내만 보인다 */
  can?: CanFn
  labels?: WorkspaceAdminLabels
  locale?: string
  formatTime?: (iso: string) => string
}

const isToolOff = (error: unknown) =>
  error instanceof ApiRequestError && error.apiError.status === 404

/**
 * 운영자의 워크스페이스 목록 - 이름 · 주소 이름 검색, 커서(「더 보기」), 한 건의 상세(멤버 표 · 기다리는 초대 수). **읽기만** 한다.
 * 백엔드 `workspace.read` + `skeleton.workspace.admin.enabled=true`. 소유자 이름은 서버가 `account.read` 가 있는 운영자에게만 준다
 */
export function AdminWorkspaces({
  api,
  can = allowAll,
  labels = defaultWorkspaceAdminLabels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: AdminWorkspacesProps) {
  if (!can(WORKSPACE_PERMISSIONS.read))
    return (
      <div className={styles.page}>
        <PageHeader title={labels.title} />
        <Alert tone="info">{labels.noPermission}</Alert>
      </div>
    )
  return <List api={api} labels={labels} formatTime={formatTime} />
}

function List({
  api,
  labels,
  formatTime,
}: {
  api: WorkspaceAdminApi
  labels: WorkspaceAdminLabels
  formatTime: (iso: string) => string
}) {
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const list = useAdminWorkspaces(api, q)
  const rows = useMemo(() => list.data?.pages.flatMap((page) => page.values) ?? [], [list.data])
  const opened = rows.find((row) => row.id === openId) ?? null

  function search(event: FormEvent) {
    event.preventDefault()
    setQ(draft.trim())
  }

  const columns: TableColumn<AdminWorkspaceRow>[] = [
    {
      key: 'name',
      header: labels.columns.name,
      rowHeader: true,
      render: (row) => (
        <>
          {row.name}
          <span className={styles.slug}>{row.slug}</span>
        </>
      ),
    },
    {
      key: 'owner',
      header: labels.columns.owner,
      render: (row) => row.ownerLabel || labels.noOwner,
    },
    { key: 'members', header: labels.columns.members, align: 'end', render: (r) => r.memberCount },
    {
      key: 'status',
      header: labels.columns.status,
      render: (row) => (
        <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {labels.status[row.status]}
        </Badge>
      ),
    },
    {
      key: 'created',
      header: labels.columns.created,
      render: (row) => <span className={styles.nowrap}>{formatTime(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: labels.columns.actions,
      align: 'end',
      render: (row) => (
        <Button
          variant="secondary"
          size="sm"
          aria-label={labels.detailFor(row.name)}
          onClick={() => setOpenId(row.id)}
        >
          {labels.detail}
        </Button>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <PageHeader title={labels.title} />
      <form className={styles.search} onSubmit={search} role="search">
        <div className={styles.searchField}>
          <Field label={labels.searchLabel}>
            {(control) => (
              <Input
                {...control}
                type="search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                autoComplete="off"
              />
            )}
          </Field>
        </div>
        <Button type="submit" variant="secondary">
          {labels.searchAction}
        </Button>
      </form>
      {list.isPending ? (
        <Skeleton label={labels.loading} />
      ) : list.isError ? (
        <Alert
          tone="danger"
          action={
            isToolOff(list.error) ? undefined : (
              <Button variant="secondary" size="sm" onClick={() => void list.refetch()}>
                {labels.retry}
              </Button>
            )
          }
        >
          {isToolOff(list.error) ? labels.notEnabled : labels.loadFailed}
        </Alert>
      ) : (
        <>
          <div
            className={list.isPlaceholderData ? styles.stale : undefined}
            aria-busy={list.isPlaceholderData}
          >
            <Table
              caption={labels.caption}
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              empty={<EmptyState title={labels.empty} headingLevel={2} />}
            />
          </div>
          {list.hasNextPage && (
            <div>
              <Button
                variant="secondary"
                loading={list.isFetchingNextPage}
                loadingLabel={labels.loading}
                onClick={() => void list.fetchNextPage()}
              >
                {labels.more}
              </Button>
            </div>
          )}
        </>
      )}
      {opened && (
        <DetailDialog
          api={api}
          row={opened}
          labels={labels}
          formatTime={formatTime}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

function DetailDialog({
  api,
  row,
  labels,
  formatTime,
  onClose,
}: {
  api: Pick<WorkspaceAdminApi, 'get'>
  row: AdminWorkspaceRow
  labels: WorkspaceAdminLabels
  formatTime: (iso: string) => string
  onClose: () => void
}) {
  const detail = useAdminWorkspace(api, row.id)
  return (
    <Dialog open onClose={onClose} title={labels.detailTitle(row.name)} closeLabel={labels.close}>
      <div className={styles.detail}>
        {detail.isPending ? (
          <Skeleton lines={3} label={labels.loading} />
        ) : detail.isError ? (
          <Alert
            tone="danger"
            action={
              <Button variant="secondary" size="sm" onClick={() => void detail.refetch()}>
                {labels.retry}
              </Button>
            }
          >
            {labels.loadFailed}
          </Alert>
        ) : (
          <>
            <p className={styles.muted}>{labels.pending(detail.data.pendingInvitations)}</p>
            <Table
              caption={labels.membersCaption}
              rows={detail.data.members}
              rowKey={(member) => member.accountId}
              columns={[
                {
                  key: 'member',
                  header: labels.memberColumns.member,
                  rowHeader: true,
                  render: (member) => member.label || labels.unnamedMember,
                },
                {
                  key: 'role',
                  header: labels.memberColumns.role,
                  render: (member) => <Badge>{labels.roles[member.role]}</Badge>,
                },
                {
                  key: 'joined',
                  header: labels.memberColumns.joined,
                  render: (member) => (
                    <span className={styles.nowrap}>{formatTime(member.joinedAt)}</span>
                  ),
                },
              ]}
            />
          </>
        )}
      </div>
    </Dialog>
  )
}
