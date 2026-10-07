import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { RequireRole } from './RequireRole'
import { createAuthSession } from './session'
import { createTokenStore } from './tokenStore'
import { fakeJwt } from './test/fixtures'
import { postSignInTarget, safeReturnPath, locationPath } from './returnTo'
import type { AuthApi } from './authApi'

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
const api: AuthApi = {
  login: unused,
  socialLogin: unused,
  me: unused,
  refresh: unused,
  logout: async () => undefined,
  magicLinkRequest: async () => undefined,
  methods: async () => {
    throw new Error('unused')
  },
  magicLinkRedeem: unused,
  cancelDeletion: unused,
}
function render(token: string | undefined, element: React.ReactElement) {
  const store = createTokenStore()
  if (token) store.set(token)
  return renderToStaticMarkup(
    <AuthProvider session={createAuthSession({ api, store })}>
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

describe('RequireRole', () => {
  it('anonymous visitors go to the login and come back (like RequireAuth)', () => {
    expect(render(undefined, <RequireRole roles={['ADMIN']} />)).toBe(
      '<i data-redirect="/login" data-from="/admin"></i>',
    )
  })
  it('a signed-in user with a matching role sees the nested route', () => {
    expect(
      render(fakeJwt({ sub: 'a', roles: ['USER', 'ADMIN'] }), <RequireRole roles={['ADMIN']} />),
    ).toBe('<b>secret</b>')
  })
  it('any one of several roles is enough', () => {
    expect(
      render(
        fakeJwt({ sub: 'a', roles: ['MODERATOR'] }),
        <RequireRole roles={['ADMIN', 'MODERATOR']} />,
      ),
    ).toBe('<b>secret</b>')
  })
  it('a signed-in user without the role is NOT signed out or redirected: the forbidden view shows (403 semantics)', () => {
    const out = render(
      fakeJwt({ sub: 'a', roles: ['USER'] }),
      <RequireRole roles={['ADMIN']} forbidden={<p>nope</p>} />,
    )
    expect(out).toBe('<p>nope</p>')
  })
  it('defaults the forbidden view to the blocked notice', () => {
    expect(
      render(fakeJwt({ sub: 'a', roles: ['USER'] }), <RequireRole roles={['ADMIN']} />),
    ).toContain('Access blocked')
  })
})

describe('redirect back after sign-in', () => {
  it('locationPath joins pathname, search and hash', () => {
    expect(locationPath({ pathname: '/notes', search: '?q=1', hash: '#top' })).toBe(
      '/notes?q=1#top',
    )
  })
  it('postSignInTarget reads where RequireAuth sent the visitor from, else the fallback', () => {
    expect(
      postSignInTarget({ from: { pathname: '/notes', search: '?page=2', hash: '' } }, '/'),
    ).toBe('/notes?page=2')
    expect(postSignInTarget(null, '/home')).toBe('/home')
    expect(postSignInTarget({ from: 'garbage' }, '/')).toBe('/')
  })
  it('safeReturnPath refuses anything that is not a same-origin path (open redirect)', () => {
    expect(safeReturnPath('/a/b?c=1')).toBe('/a/b?c=1')
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      'javascript:alert(1)',
      '/\\evil.example',
      42,
      undefined,
      '',
    ])
      expect(safeReturnPath(bad, '/')).toBe('/')
  })
  it('never bounces back to an auth page itself', () => {
    expect(postSignInTarget({ from: { pathname: '/login', search: '', hash: '' } }, '/')).toBe('/')
  })
})
