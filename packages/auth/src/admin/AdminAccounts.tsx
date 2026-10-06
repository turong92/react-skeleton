import { Alert, PageHeader, Skeleton } from '@skeleton/ui'
import { useCallback, useState } from 'react'
import type { AccountStatus } from '../account/types'
import { authErrorMessage } from '../screens/errors'
import { mergeLabels, type AuthLabels } from '../screens/labels'
import { useResource } from '../screens/useResource'
import { AccountStateNotice } from '../screens/AccountStateNotice'
import { AdminAccountsTable } from './AdminAccountsTable'
import { adminBlocked } from './adminErrors'
import type { AdminAccountsApi } from './adminApi'

export type AdminAccountsProps = {
  api: AdminAccountsApi
  assignableRoles: string[]
  pageSize?: number
  formatDate?: (iso: string) => string
  /** 차단 안내의 「문의」 링크 */
  supportHref?: string
  labels?: Partial<AuthLabels>
}

/** 운영자 계정 화면 — 목록을 불러 와 표에 잇는다. 403(ADMIN 이 아니거나 저장된 계정이 더는 활성 관리자가 아님)은 「접근 차단」 안내 — 로그아웃하지 않는다 */
export function AdminAccounts({
  api,
  assignableRoles,
  pageSize = 20,
  formatDate,
  supportHref,
  labels: given,
}: AdminAccountsProps) {
  const labels = mergeLabels(given)
  const [query, setQuery] = useState<{ email: string; status: AccountStatus | '' }>({
    email: '',
    status: '',
  })
  const [page, setPage] = useState(0)
  const load = useCallback(
    () =>
      api.list({
        email: query.email.trim(),
        status: query.status || undefined,
        page,
        size: pageSize,
      }),
    [api, query, page, pageSize],
  )
  const list = useResource(load)
  const after = (task: () => Promise<unknown>) => async () => {
    await task()
    list.reload()
  }

  if (adminBlocked(list.error))
    return <AccountStateNotice kind="blocked" supportHref={supportHref} labels={given} />
  return (
    <div>
      <PageHeader title={labels.adminTitle} />
      {list.error ? (
        <Alert tone="danger">{authErrorMessage(list.error, labels).message}</Alert>
      ) : !list.data ? (
        <Skeleton />
      ) : (
        <AdminAccountsTable
          accounts={list.data.values}
          pagination={list.data.pagination}
          assignableRoles={assignableRoles}
          query={query}
          onQueryChange={(next) => {
            setQuery(next)
            setPage(0)
          }}
          onPage={setPage}
          onSuspend={(id, reason) => after(() => api.suspend(id, reason))()}
          onUnsuspend={(id) => after(() => api.unsuspend(id))()}
          onRestore={(id) => after(() => api.restore(id))()}
          onGrantRole={(id, role) => after(() => api.grantRole(id, role))()}
          onRevokeRole={(id, role) => after(() => api.revokeRole(id, role))()}
          formatDate={formatDate}
          labels={given}
        />
      )}
    </div>
  )
}
