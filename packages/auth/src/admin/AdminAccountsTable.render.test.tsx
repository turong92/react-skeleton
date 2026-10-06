import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AdminAccount } from '../account/types'
import { AdminAccountsTable } from './AdminAccountsTable'
import { rowActions } from './rowActions'

const account = (over: Partial<AdminAccount>): AdminAccount => ({
  id: 'acc_1',
  email: 'a@b.c',
  status: 'ACTIVE',
  roles: ['USER'],
  displayName: 'Ann',
  createdAt: '2026-01-01T00:00:00Z',
  lastLoginAt: null,
  suspendedReason: null,
  purgeAfter: null,
  ...over,
})
const noop = async () => undefined
const base = {
  accounts: [
    account({}),
    account({ id: 'acc_2', email: 'x@y.z', status: 'SUSPENDED', suspendedReason: 'spam' }),
  ],
  pagination: {
    page: 0,
    size: 20,
    totalElements: 2,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  },
  assignableRoles: ['ADMIN', 'MODERATOR'],
  query: { email: '', status: '' as const },
  onQueryChange: () => undefined,
  onPage: () => undefined,
  onSuspend: noop,
  onUnsuspend: noop,
  onRestore: noop,
  onGrantRole: noop,
  onRevokeRole: noop,
}

describe('rowActions: which commands the backend allows for an account state', () => {
  it('active: suspend + roles; suspended: unsuspend; deleted: restore only', () => {
    expect(rowActions(account({ status: 'ACTIVE' }), ['MODERATOR']).map((a) => a.kind)).toEqual([
      'suspend',
      'grant:MODERATOR',
    ])
    expect(
      rowActions(account({ status: 'ACTIVE', roles: ['USER', 'MODERATOR'] }), ['MODERATOR']).map(
        (a) => a.kind,
      ),
    ).toEqual(['suspend', 'revoke:MODERATOR'])
    expect(rowActions(account({ status: 'SUSPENDED' }), []).map((a) => a.kind)).toEqual([
      'unsuspend',
    ])
    expect(rowActions(account({ status: 'DELETED' }), ['ADMIN']).map((a) => a.kind)).toEqual([
      'restore',
    ])
  })
})

describe('AdminAccountsTable', () => {
  it('renders the accounts with status labels and the search / filter controls', () => {
    const out = renderToStaticMarkup(<AdminAccountsTable {...base} />)
    expect(out).toContain('a@b.c')
    expect(out).toContain('Suspended')
    expect(out).toContain('Search by email')
    expect(out).toContain('Accounts')
  })
  it('says so when nothing matches', () => {
    expect(renderToStaticMarkup(<AdminAccountsTable {...base} accounts={[]} />)).toContain(
      'No accounts match.',
    )
  })
})
