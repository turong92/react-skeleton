import { AuthProvider } from '@skeleton/auth'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { APP_NAME } from '../appName'
import { createAuth, createDeferredTokens } from '../auth/createAuth'
import { RootLayout } from './RootLayout'

const unused = async () => {
  throw new Error('unused')
}

describe('RootLayout', () => {
  it('wraps the page in the AppShell with the app name and the theme toggle, with no browser global (server render)', () => {
    const auth = createAuth({
      api: {
        login: unused,
        socialLogin: unused,
        me: unused,
        refresh: unused,
        logout: unused,
        magicLinkRequest: unused,
        magicLinkRedeem: unused,
      },
      tokens: createDeferredTokens(),
    })
    const html = renderToString(
      <AuthProvider session={auth.session}>
        <MemoryRouter>
          <RootLayout />
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(html).toContain(`<strong>${APP_NAME}</strong>`)
    expect(html).toMatch(/<header[\s\S]*aria-label="Theme: system"[\s\S]*<\/header>/)
    expect(html).toContain('<main')
    expect(html).not.toContain('로그아웃')
  })
})
