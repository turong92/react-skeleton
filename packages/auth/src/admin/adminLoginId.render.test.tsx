import { renderToStaticMarkup } from 'react-dom/server'
import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import type { AdminAccount } from '../account/types'
import { koAuthLabels } from '../screens/labels.ko'
import { AdminAccountsTable } from './AdminAccountsTable'
import { createAdminAccountsApi } from './adminApi'

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
  pagination: {
    page: 0,
    size: 20,
    totalElements: 2,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  },
  assignableRoles: ['ADMIN'],
  query: { email: '', status: '' as const },
  onQueryChange: () => undefined,
  onPage: () => undefined,
  onSuspend: noop,
  onUnsuspend: noop,
  onRestore: noop,
  onGrantRole: noop,
  onRevokeRole: noop,
}

describe('admin table: login id column and exact lookup (design §11, §13.1)', () => {
  it('shows the column and the "find by username" box when the response carries the key', () => {
    const out = renderToStaticMarkup(
      <AdminAccountsTable
        {...base}
        accounts={[account({ loginId: 'sumin.kim' }), account({ id: 'acc_2', loginId: null })]}
      />,
    )
    expect(out).toContain('<th')
    expect(out).toContain('sumin.kim')
    expect(out).toMatch(/<th[^>]*>Username<\/th>/)
    expect(out).toContain('Find by username')
  })

  it('a not-yet-chosen account shows a dash, not an empty cell', () => {
    const out = renderToStaticMarkup(
      <AdminAccountsTable {...base} accounts={[account({ loginId: null })]} />,
    )
    expect(out).toMatch(/<td[^>]*>-<\/td>/)
  })

  it('no column and no box when no row has the key (login id off)', () => {
    const out = renderToStaticMarkup(<AdminAccountsTable {...base} accounts={[account({})]} />)
    expect(out).not.toContain('Username')
    expect(out).not.toContain('Find by username')
  })

  it('keeps the box when an exact lookup finds nothing (the app tells it stays on)', () => {
    const out = renderToStaticMarkup(
      <AdminAccountsTable
        {...base}
        accounts={[]}
        showLoginId
        query={{ ...base.query, loginId: 'zz' }}
      />,
    )
    expect(out).toContain('Find by username')
    expect(out).toContain('value="zz"')
  })

  it('the lookup is a search form with a bordered "Find" button - the exact id is sent on submit, not on every keystroke', () => {
    const out = renderToStaticMarkup(
      <AdminAccountsTable {...base} accounts={[account({ loginId: 'sumin.kim' })]} />,
    )
    expect(out).toMatch(/<form[^>]*role="search"[^>]*>/)
    expect(out).toMatch(
      /<button[^>]*type="submit"[^>]*data-variant="secondary"[^>]*>Find<\/button>/,
    )
  })

  it('speaks Korean with the same keys', () => {
    const out = renderToStaticMarkup(
      <AdminAccountsTable
        {...base}
        accounts={[account({ loginId: 'a.b' })]}
        labels={koAuthLabels}
      />,
    )
    expect(out).toMatch(/<th[^>]*>아이디<\/th>/)
    expect(out).toContain('아이디로 찾기')
  })
})

describe('adminApi.list: ?loginId= exact', () => {
  it('sends loginId only when it is set', async () => {
    const calls: Array<ApiRequest | undefined> = []
    const client = {
      page: async (_p: string, r?: ApiRequest) => (calls.push(r), { values: [] }) as never,
      value: async () => ({}) as never,
      list: async () => [] as never,
      noContent: async () => undefined,
    }
    const api = createAdminAccountsApi(client)
    await api.list({ loginId: 'sumin.kim', page: 0 })
    await api.list({ loginId: '' })
    expect(calls[0]?.params).toEqual({ loginId: 'sumin.kim', page: 0 })
    expect(calls[1]?.params).toEqual({})
  })
})
