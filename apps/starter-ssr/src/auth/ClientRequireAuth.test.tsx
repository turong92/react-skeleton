import { createAuth, createDeferredTokens } from './createAuth'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthRoot } from './AuthRoot'
import { ClientRequireAuth } from './ClientRequireAuth'

const auth = createAuth({
  api: {
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
  },
  tokens: createDeferredTokens({
    storage: {
      getItem: () => 'a-token-the-server-never-sees',
      setItem: () => undefined,
      removeItem: () => undefined,
    },
  }),
})

function page(path: string) {
  return renderToString(
    <AuthRoot auth={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<ClientRequireAuth placeholderLabel="확인 중" />}>
            <Route path="/account" element={<p>secret account</p>} />
          </Route>
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthRoot>,
  )
}

describe('ClientRequireAuth — the protected route on the server and during hydration', () => {
  it('renders a neutral placeholder, never the protected content and never a redirect, until the session is restored', () => {
    const html = page('/account')
    expect(html).toContain('확인 중')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('secret account')
    expect(html).not.toContain('login page')
  })

  it('takes the placeholder text from a prop so a project can translate it', () => {
    const html = renderToString(
      <AuthRoot auth={auth}>
        <MemoryRouter initialEntries={['/x']}>
          <Routes>
            <Route element={<ClientRequireAuth placeholderLabel="Checking" />}>
              <Route path="/x" element={<p>x</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthRoot>,
    )
    expect(html).toContain('Checking')
  })
})
