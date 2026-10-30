import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultWorkspaceLabels as L } from './labels'
import { workspaceKeys } from './queries'
import { detail, member, stubApi } from './test/fixtures'
import type { WorkspaceRole } from './types'
import { WorkspaceSettings } from './WorkspaceSettings'

const members = [
  member({ accountId: 'acc_owner', label: 'Olive', role: 'OWNER' }),
  member({ accountId: 'acc_admin', label: 'Adam', role: 'ADMIN' }),
  member({ accountId: 'acc_ann', label: 'Ann', role: 'MEMBER' }),
  member({ accountId: 'acc_nolabel', label: null, role: 'MEMBER' }),
]
const MINE: Record<WorkspaceRole, string> = {
  OWNER: 'acc_owner',
  ADMIN: 'acc_admin',
  MEMBER: 'acc_ann',
}

function render(role: WorkspaceRole) {
  const client = new QueryClient()
  client.setQueryData(workspaceKeys.members('ws_1'), members)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <WorkspaceSettings
        api={stubApi()}
        workspace={detail({ role })}
        accountId={MINE[role]}
        onLeft={() => {}}
      />
    </QueryClientProvider>,
  )
}
const leaveButton = (html: string) =>
  new RegExp(`<button[^>]*>${L.settings.leave.action}<`).test(html)
const hasInput = (html: string, label: string) =>
  new RegExp(`<label[^>]*>${label}[\\s\\S]*?<input`).test(html)

describe('WorkspaceSettings — what each role is shown (the server still decides)', () => {
  it('owner: edits name and address, changes roles of non-owners, has a menu on every other row, and is told to transfer before leaving', () => {
    const html = render('OWNER')
    expect(hasInput(html, L.form.nameLabel)).toBe(true)
    expect(hasInput(html, L.form.slugLabel)).toBe(true)
    expect(html).toContain(`aria-label="${L.settings.roleOf('Adam')}"`)
    expect(html).toContain(`aria-label="${L.settings.roleOf('Ann')}"`)
    expect(html).not.toContain(`aria-label="${L.settings.roleOf('Olive')}"`)
    for (const name of ['Adam', 'Ann'])
      expect(html).toContain(`aria-label="${L.settings.actionsOf(name)}"`)
    expect(html).not.toContain(`aria-label="${L.settings.actionsOf('Olive')}"`)
    expect(html).toContain(L.settings.leave.ownerHint)
    expect(leaveButton(html)).toBe(false)
  })

  it('admin: edits name and address, only removes plain members (no role select, no menu on admin or owner rows), may leave', () => {
    const html = render('ADMIN')
    expect(hasInput(html, L.form.nameLabel)).toBe(true)
    expect(html).not.toContain('<select')
    expect(html).toContain(`aria-label="${L.settings.actionsOf('Ann')}"`)
    expect(html).not.toContain(`aria-label="${L.settings.actionsOf('Olive')}"`)
    expect(html).not.toContain(`aria-label="${L.settings.actionsOf('Adam')}"`)
    expect(leaveButton(html)).toBe(true)
    expect(html).not.toContain(L.settings.leave.ownerHint)
  })

  it('member: reads only — no fields, no select, no menu — and may leave', () => {
    const html = render('MEMBER')
    expect(html).toContain(L.settings.readOnlyHint)
    expect(html).not.toContain('<input')
    expect(html).not.toContain('<select')
    expect(html).not.toContain('aria-haspopup')
    expect(leaveButton(html)).toBe(true)
  })

  it('draws every member by label, marks my row, shows roles as words, and never draws an account id', () => {
    const html = render('ADMIN')
    for (const name of ['Olive', 'Adam', 'Ann', L.settings.unnamedMember])
      expect(html).toContain(name)
    expect(html).toContain(L.settings.you)
    expect(html).toContain(L.roles.OWNER)
    expect(html).not.toContain('acc_')
    expect(html).toContain(L.settings.membersCount(4))
  })
})
