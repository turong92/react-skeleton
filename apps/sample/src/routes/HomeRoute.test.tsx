import { AuthProvider, createAuthSession, createTokenStore, type AuthApi } from '@skeleton/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { HomeRoute } from './HomeRoute'

afterEach(() => i18n.setLocale('ko', { remember: false }))

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

function page(signedIn: boolean) {
  const store = createTokenStore()
  if (signedIn) store.set('header.payload.signature')
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider session={createAuthSession({ api, store })}>
        <MemoryRouter>
          <HomeRoute />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('/ (HomeRoute)', () => {
  it('a signed-out visitor gets the landing page: one h1, the sections, and a link to sign up', () => {
    const html = page(false)
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain(i18n.t('landing.title'))
    expect(html).toContain(i18n.t('landing.features.title'))
    expect(html).toContain(i18n.t('landing.pricing.title'))
    expect(html).toContain(i18n.t('landing.faq.title'))
    expect(html).toMatch(/<a[^>]*href="\/sign-up"/)
    expect(html).not.toContain(i18n.t('dashboard.statsLabel'))
  })

  it('a signed-in user goes straight to the dashboard (no landing)', () => {
    const html = page(true)
    expect(html).toContain(i18n.t('dashboard.statsLabel'))
    expect(html).not.toContain(i18n.t('landing.title'))
  })

  it('the landing draws in English when the language is English (every visible text comes from the catalog)', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = page(false)
    expect(html).toContain(i18n.t('landing.title'))
    expect(html).toContain('$') // dollars, not won
    expect(html).not.toContain('₩')
  })

  it('in Korean the prices are in won', () => {
    expect(page(false)).toContain('₩')
  })
})
