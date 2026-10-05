import { AuthProvider, createAuthSession, createTokenStore, type AuthApi } from '@skeleton/auth'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RootLayout } from './RootLayout'

afterEach(() => vi.unstubAllGlobals())

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
}

describe('RootLayout', () => {
  it('wraps the page in the AppShell with the theme toggle in the header', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const html = renderToStaticMarkup(
      <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
        <MemoryRouter>
          <RootLayout />
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(html).toMatch(/<header[\s\S]*aria-label="Theme: system"[\s\S]*<\/header>/)
    expect(html).toContain('<main')
  })
})
