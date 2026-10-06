import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { RequireAuth } from './RequireAuth'
import { useAuth } from './useAuth'
import { createAuthSession } from './session'
import { createTokenStore } from './tokenStore'
import { fakeJwt } from './test/fixtures'
import type { AuthApi } from './authApi'

// Navigate 는 effect 안에서 이동해 서버 렌더에서는 아무것도 안 그린다 — 어디로 보내는지만 표식으로 바꾼다
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    Navigate: ({ to, state }: { to: string; state?: { from?: { pathname: string } } }) => (
      <i data-redirect={to} data-from={state?.from?.pathname} />
    ),
  }
})

const api: AuthApi = {
  login: async () => {
    throw new Error('unused')
  },
  socialLogin: async () => {
    throw new Error('unused')
  },
  me: async () => {
    throw new Error('unused')
  },
  refresh: async () => {
    throw new Error('unused')
  },
  logout: async () => undefined,
  magicLinkRequest: async () => undefined,
  methods: async () => {
    throw new Error('unused')
  },
  magicLinkRedeem: async () => {
    throw new Error('unused')
  },
}

function sessionWith(token?: string) {
  const store = createTokenStore()
  if (token) store.set(token)
  return createAuthSession({ api, store })
}

function Probe() {
  const auth = useAuth()
  return (
    <p>
      {auth.status}:{auth.principal?.accountId ?? '-'}
    </p>
  )
}

describe('AuthProvider / useAuth', () => {
  it('exposes the session state to children', () => {
    const anonymous = renderToStaticMarkup(
      <AuthProvider session={sessionWith()}>
        <Probe />
      </AuthProvider>,
    )
    expect(anonymous).toBe('<p>anonymous:-</p>')

    const signedIn = renderToStaticMarkup(
      <AuthProvider session={sessionWith(fakeJwt({ sub: 'acc_7' }))}>
        <Probe />
      </AuthProvider>,
    )
    expect(signedIn).toBe('<p>authenticated:acc_7</p>')
  })

  it('offers login, socialLogin, magicLinkLogin, signIn, restore, logout and refresh bound to the session', () => {
    function Keys() {
      const auth = useAuth()
      return <p>{Object.keys(auth).sort().join(',')}</p>
    }
    expect(
      renderToStaticMarkup(
        <AuthProvider session={sessionWith()}>
          <Keys />
        </AuthProvider>,
      ),
    ).toBe(
      '<p>login,logout,magicLinkLogin,principal,refresh,restore,signIn,socialLogin,status,token</p>',
    )
  })

  it('throws a clear error when used outside the provider', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderToStaticMarkup(<Probe />)).toThrow(/AuthProvider/)
    quiet.mockRestore()
  })
})

describe('RequireAuth', () => {
  function render(token: string | undefined, element: React.ReactElement) {
    return renderToStaticMarkup(
      <AuthProvider session={sessionWith(token)}>
        <MemoryRouter initialEntries={['/account']}>
          <Routes>
            <Route path="/account" element={element}>
              <Route index element={<b>nested</b>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  it('sends an anonymous visitor to /login remembering where they came from', () => {
    const html = render(undefined, <RequireAuth />)
    expect(html).toBe('<i data-redirect="/login" data-from="/account"></i>')
  })

  it('the redirect target is a prop', () => {
    expect(render(undefined, <RequireAuth redirectTo="/sign-in" />)).toContain(
      'data-redirect="/sign-in"',
    )
  })

  it('renders the nested route (Outlet) for a signed-in user', () => {
    expect(render(fakeJwt({ sub: 'acc_1' }), <RequireAuth />)).toBe('<b>nested</b>')
  })

  it('renders its children instead of the Outlet when given', () => {
    expect(
      render(
        fakeJwt({ sub: 'acc_1' }),
        <RequireAuth>
          <u>direct</u>
        </RequireAuth>,
      ),
    ).toBe('<u>direct</u>')
  })
})
