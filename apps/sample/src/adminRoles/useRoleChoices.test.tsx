import type { AdminRole } from '@skeleton/auth/admin'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { OperatorSession } from '../test-support/operatorSession'
import { adminRolesKey, useRoleChoices } from './useRoleChoices'

const role = (name: string): AdminRole => ({
  name,
  description: null,
  permissions: [],
  protected: false,
  holders: null,
})

function Probe() {
  return (
    <p>
      {useRoleChoices()
        .map((c) => `${c.value}=${c.label}`)
        .join(',')}
    </p>
  )
}
const render = (roles?: AdminRole[], permissions = ['authz.roles']) => {
  const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } })
  if (roles) client.setQueryData(adminRolesKey, roles)
  return renderToStaticMarkup(
    <OperatorSession permissions={permissions}>
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    </OperatorSession>,
  )
}

describe('useRoleChoices - the broadcast audience roles come from GET /admin/roles', () => {
  it('offers each role the server listed, by name', () => {
    expect(render([role('USER'), role('CS')])).toBe('<p>USER=USER,CS=CS</p>')
  })
  it('is empty until the server has answered, and without authz.roles (the editor then asks for a typed name)', () => {
    expect(render()).toBe('<p></p>')
    expect(render([role('USER')], ['notification-broadcast.send'])).toBe('<p></p>')
  })
})
