import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { RequirePermission } from './RequirePermission'
import { createAuthSession } from './session'
import { createTokenStore } from './tokenStore'
import type { AuthApi } from './authApi'
import type { AuthTokenResponse } from './types'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    Navigate: ({ to, state }: { to: string; state?: { from?: { pathname: string } } }) => (
      <i data-redirect={to} data-from={state?.from?.pathname} />
    ),
  }
})

const unused = async () => {
  throw new Error('unused')
}
const api = { me: unused } as unknown as AuthApi

/** `permissions` 가 undefined 면 로그인하지 않은 방문자 */
function render(permissions: string[] | undefined, element: React.ReactElement) {
  const session = createAuthSession({ api, store: createTokenStore() })
  if (permissions) {
    const response: AuthTokenResponse = {
      accessToken: 'tok',
      tokenType: 'Bearer',
      expiresAt: '2026-06-12T01:00:00Z',
      principal: { accountId: 'a', roles: ['CS'], permissions },
    }
    session.signIn(response)
  }
  return renderToStaticMarkup(
    <AuthProvider session={session}>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={element}>
            <Route index element={<b>secret</b>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('RequirePermission', () => {
  it('anonymous visitors go to the login and come back', () => {
    expect(render(undefined, <RequirePermission anyOf={['payment.read']} />)).toBe(
      '<i data-redirect="/login" data-from="/admin"></i>',
    )
  })
  it('a signed-in user with the permission sees the nested route', () => {
    expect(render(['payment.read'], <RequirePermission anyOf={['payment.read']} />)).toBe(
      '<b>secret</b>',
    )
  })
  it('* (every permission) passes', () => {
    expect(render(['*'], <RequirePermission anyOf={['account.read']} />)).toBe('<b>secret</b>')
  })
  it('without the permission the session stays and the forbidden view shows', () => {
    expect(
      render(
        ['payment.read'],
        <RequirePermission anyOf={['account.read']} forbidden={<p>no</p>} />,
      ),
    ).toBe('<p>no</p>')
    expect(render([], <RequirePermission anyOf={['account.read']} />)).toContain('Access blocked')
  })
  it('while permissions are still being fetched (null) nothing is drawn - neither the page nor the blocked notice', () => {
    const session = createAuthSession({ api, store: createTokenStore() })
    session.signIn({
      accessToken: 'tok',
      tokenType: 'Bearer',
      expiresAt: '2026-06-12T01:00:00Z',
      principal: { accountId: 'a', roles: [], permissions: undefined },
    })
    const html = renderToStaticMarkup(
      <AuthProvider session={session}>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={<RequirePermission anyOf={['x.y']} pending={<i>wait</i>} />}
            >
              <Route index element={<b>secret</b>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(html).toBe('<i>wait</i>')
  })
  it('any one of several is enough', () => {
    expect(
      render(['account.roles'], <RequirePermission anyOf={['authz.roles', 'account.roles']} />),
    ).toBe('<b>secret</b>')
  })
})
