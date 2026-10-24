import type { AssignableRole } from '@skeleton/auth/admin'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { OperatorSession } from '../test-support/operatorSession'
import { assignableRolesKey, useAssignableRoles } from './useAssignableRoles'

const role = (name: string, permissions: string[] = []): AssignableRole => ({ name, permissions })

function Probe() {
  return (
    <p>
      {useAssignableRoles()
        .map((r) => `${r.name}:${r.permissions.join('+')}`)
        .join(',')}
    </p>
  )
}
const render = (roles?: AssignableRole[], permissions = ['account.roles']) => {
  const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } })
  if (roles) client.setQueryData(assignableRolesKey, roles)
  return renderToStaticMarkup(
    <OperatorSession permissions={permissions}>
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    </OperatorSession>,
  )
}

describe('useAssignableRoles - the roles an operator can give (with their permissions) come from GET /admin/accounts/assignable-roles', () => {
  it('lists what the server answered, default roles with no permissions and runtime roles alike', () => {
    expect(
      render([role('USER'), role('ADMIN', ['*']), role('CS', ['payment.read', 'payment.refund'])]),
    ).toBe('<p>USER:,ADMIN:*,CS:payment.read+payment.refund</p>')
  })
  it('is empty until the server has answered - nothing is guessed', () => {
    expect(render()).toBe('<p></p>')
  })
  it('is switched off without account.roles (the server would answer 403 every time)', () => {
    expect(render([role('CS')], ['account.read'])).toBe('<p></p>')
    expect(render([role('CS')], ['*'])).toBe('<p>CS:</p>')
  })
})
