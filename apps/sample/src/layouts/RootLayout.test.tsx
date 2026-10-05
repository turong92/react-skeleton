import { AuthProvider, createAuthSession, createTokenStore, type AuthApi } from '@skeleton/auth'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { strings } from '../strings'
import { RootLayout } from './RootLayout'

afterEach(() => vi.unstubAllGlobals())

const unused = async () => {
  throw new Error('unused')
}
const api: AuthApi = { login: unused, socialLogin: unused, me: unused }

describe('RootLayout (signed out)', () => {
  it('shows the brand and the theme toggle only — no menu, no bell, no sign-out before login', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const html = renderToStaticMarkup(
      <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
        <MemoryRouter>
          <RootLayout />
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(html).toContain(strings.appName)
    expect(html).toMatch(/<header[\s\S]*aria-label="Theme: system"[\s\S]*<\/header>/)
    expect(html).not.toContain(strings.nav.notes)
    expect(html).not.toContain(strings.header.signOut)
    expect(html).toContain('<main')
  })
})
