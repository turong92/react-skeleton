import type { AdminRole } from '@skeleton/auth/admin'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { adminRolesKey, useAssignableRoles } from './useAssignableRoles'

const role = (name: string): AdminRole => ({
  name,
  description: '',
  permissions: [],
  protected: false,
  holders: 0,
})

function Probe() {
  return <p>{useAssignableRoles().join(',')}</p>
}
const render = (roles?: AdminRole[]) => {
  const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } })
  if (roles) client.setQueryData(adminRolesKey, roles)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  )
}

describe('useAssignableRoles - the roles an operator can give come from GET /admin/roles', () => {
  it('lists the names the server answered, including roles made at runtime', () => {
    expect(render([role('ADMIN'), role('MODERATOR'), role('CS')])).toBe('<p>ADMIN,MODERATOR,CS</p>')
  })
  it('is empty until the server has answered - nothing is guessed', () => {
    expect(render()).toBe('<p></p>')
  })
})
