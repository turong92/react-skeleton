import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AdminWorkspaces } from './AdminWorkspaces'
import { adminKeys } from './hooks'
import { defaultWorkspaceAdminLabels as L } from './labels'
import type { AdminWorkspaceRow } from './types'

const rows: AdminWorkspaceRow[] = [
  {
    id: 'ws_1',
    name: 'Acme',
    slug: 'acme',
    ownerLabel: 'Olive',
    memberCount: 4,
    status: 'ACTIVE',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'ws_2',
    name: 'Old Co',
    slug: 'old-co',
    ownerLabel: null,
    memberCount: 1,
    status: 'CLOSED',
    createdAt: '2026-09-01T00:00:00Z',
  },
]
const api = {
  list: async () => ({ values: rows, cursor: { hasNext: false }, meta: { timestamp: '' } }),
  get: async () => {
    throw new Error('not used')
  },
}

function render(can?: (key: string) => boolean) {
  const client = new QueryClient()
  client.setQueryData(adminKeys.list(''), {
    pages: [{ values: rows, cursor: { hasNext: false } }],
    pageParams: [undefined],
  })
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AdminWorkspaces api={api} can={can} />
    </QueryClientProvider>,
  )
}

describe('AdminWorkspaces — reading only, hidden by can("workspace.read")', () => {
  it('draws name, owner, member count and status; an ownerless row says so; no account or workspace id', () => {
    const html = render()
    for (const text of ['Acme', 'Olive', 'Old Co', L.status.ACTIVE, L.status.CLOSED, L.noOwner])
      expect(html).toContain(text)
    expect(html).not.toContain('ws_1')
    expect(html).toContain(`aria-label="${L.detailFor('Acme')}"`)
  })

  it('has a search field and no write control (no create, no delete, no edit)', () => {
    const html = render()
    expect(html).toContain(L.searchLabel)
    expect(html).not.toMatch(/\b(Delete|Remove|Create|Edit)\b|Close workspace/i)
  })

  it('without workspace.read it says so and draws no list', () => {
    const html = render((key) => key !== 'workspace.read')
    expect(html).toContain(L.noPermission)
    expect(html).not.toContain('<table')
    expect(html).not.toContain('Acme')
  })
})
