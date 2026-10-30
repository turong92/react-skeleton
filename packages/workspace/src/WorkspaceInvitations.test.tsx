import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultWorkspaceLabels as L } from './labels'
import { workspaceKeys } from './queries'
import { detail, invitation, stubApi } from './test/fixtures'
import type { WorkspaceDetail, WorkspaceRole } from './types'
import { WorkspaceInvitations } from './WorkspaceInvitations'

const pending = [
  invitation({ id: 'wsi_1', email: 'live@example.com' }),
  invitation({ id: 'wsi_2', email: 'old@example.com', expired: true, role: 'ADMIN' }),
]

function render(role: WorkspaceRole, over: Partial<WorkspaceDetail> = {}) {
  const client = new QueryClient()
  client.setQueryData(workspaceKeys.invitations('ws_1'), pending)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <WorkspaceInvitations api={stubApi()} workspace={detail({ role, ...over })} />
    </QueryClientProvider>,
  )
}
const sendButton = (html: string) =>
  new RegExp(`<button[^>]*>(?:(?!</button>)[\\s\\S])*${L.invitations.send}`).exec(html)?.[0] ?? ''

describe('WorkspaceInvitations — what each role is shown (the server still decides)', () => {
  it('owner: types addresses, picks admin or member, sees the pending table with resend and revoke per row', () => {
    const html = render('OWNER')
    expect(html).toContain(L.invitations.emailsLabel)
    expect(html).toContain('<textarea')
    expect(html).toContain(`<option value="ADMIN"`)
    expect(html).toContain(`<option value="MEMBER"`)
    for (const email of ['live@example.com', 'old@example.com']) {
      expect(html).toContain(email)
      expect(html).toContain(`aria-label="${L.invitations.resendFor(email)}"`)
      expect(html).toContain(`aria-label="${L.invitations.revokeFor(email)}"`)
    }
  })

  it('admin: may only invite plain members, so there is no role to pick', () => {
    const html = render('ADMIN')
    expect(html).toContain('<textarea')
    expect(html).not.toContain('<select')
  })

  it('member: reads a sentence, no form, no table, nothing to press', () => {
    const html = render('MEMBER')
    expect(html).toContain(L.invitations.noPermission)
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('<table')
    expect(html).not.toContain(L.invitations.send)
  })

  it('an expired invitation is marked as expired; a live one shows when it expires and is not marked', () => {
    const html = render('OWNER')
    expect(html.split(L.invitations.expired).length - 1).toBe(1)
  })

  it('seats are shown as members + pending against the limit only when the app set a limit', () => {
    expect(render('OWNER', { memberCount: 2, pendingInvitations: 1, seatLimit: 5 })).toContain(
      L.invitations.seats(3, 5),
    )
    expect(render('OWNER', { seatLimit: null })).not.toContain(L.invitations.seats(4, 5))
    expect(render('OWNER', { seatLimit: null })).not.toMatch(/\d+ \/ \d+/)
  })

  it('a full workspace says so and cannot send (every address would come back seat-limited)', () => {
    const html = render('OWNER', { memberCount: 3, pendingInvitations: 2, seatLimit: 5 })
    expect(html).toContain(L.invitations.seatsFull)
    expect(sendButton(html)).toMatch(/disabled/)
    expect(
      sendButton(render('OWNER', { memberCount: 1, pendingInvitations: 0, seatLimit: 5 })),
    ).not.toMatch(/disabled/)
  })

  it('never draws an account id', () => {
    expect(render('OWNER')).not.toContain('acc_')
  })
})
