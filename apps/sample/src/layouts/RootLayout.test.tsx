import { AuthProvider, createAuthSession, createTokenStore, type AuthApi } from '@skeleton/auth'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../i18n'
import { RootLayout } from './RootLayout'

afterEach(async () => {
  vi.unstubAllGlobals()
  await i18n.setLocale('ko', { remember: false })
})

const unused = async () => {
  throw new Error('unused')
}
const api: AuthApi = {
  login: unused,
  socialLogin: unused,
  me: unused,
  refresh: unused,
  logout: unused,
  magicLinkRequest: unused,
  methods: async () => {
    throw new Error('unused')
  },
  magicLinkRedeem: unused,
}

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
    expect(html).toContain(i18n.t('appName'))
    expect(html).toMatch(/<header[\s\S]*aria-label="Theme: system"[\s\S]*<\/header>/)
    expect(html).not.toContain(i18n.t('nav.notes'))
    expect(html).not.toContain(i18n.t('header.signOut'))
    expect(html).toContain('<main')
  })

  it('has the language menu next to the theme toggle — named in the current language, options in their own', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const html = renderToStaticMarkup(
      <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
        <MemoryRouter>
          <RootLayout />
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(html).toMatch(/<select[^>]*aria-label="언어"/)
    expect(html).toContain('>한국어</option>')
    expect(html).toContain('>English</option>')
  })

  it('draws the whole header in English when the language is English', async () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    await i18n.setLocale('en', { remember: false })
    const html = renderToStaticMarkup(
      <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
        <MemoryRouter>
          <RootLayout />
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(html).toMatch(/<select[^>]*aria-label="Language"/)
    expect(html).toMatch(/<option value="en" lang="en" selected="">English<\/option>/)
  })

  it('has a footer with the legal links and the cookie settings button, and draws no consent banner on the server', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const html = renderToStaticMarkup(
      <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
        <MemoryRouter>
          <RootLayout />
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(html).toMatch(/<footer[\s\S]*href="\/terms"[\s\S]*<\/footer>/)
    expect(html).toMatch(/<footer[\s\S]*href="\/privacy"[\s\S]*<\/footer>/)
    expect(html).toContain(i18n.t('footer.cookieSettings'))
    expect(html).not.toContain(i18n.t('consent.title'))
  })

  it('a signed-out visitor has a sign-in link in the header', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const html = renderToStaticMarkup(
      <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
        <MemoryRouter>
          <RootLayout />
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(html).toMatch(new RegExp(`<a[^>]*href="/login"[^>]*>${i18n.t('header.signIn')}</a>`))
  })
})
