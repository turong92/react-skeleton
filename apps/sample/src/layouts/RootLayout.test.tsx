import { AuthProvider, createAuthSession, createTokenStore, type AuthApi } from '@skeleton/auth'
import { paymentKeys } from '@skeleton/payment'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../i18n'
import { AdminLinks, RootLayout } from './RootLayout'

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
  cancelDeletion: unused,
}

describe('RootLayout (signed out)', () => {
  it('shows the brand and the theme toggle only — no menu, no bell, no sign-out before login', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const html = renderToStaticMarkup(
      <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <RootLayout />
          </MemoryRouter>
        </QueryClientProvider>
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
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <RootLayout />
          </MemoryRouter>
        </QueryClientProvider>
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
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <RootLayout />
          </MemoryRouter>
        </QueryClientProvider>
      </AuthProvider>,
    )
    expect(html).toMatch(/<select[^>]*aria-label="Language"/)
    expect(html).toMatch(/<option value="en" lang="en" selected="">English<\/option>/)
  })

  it('has a footer with the legal links and the cookie settings button, and draws no consent banner on the server', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const html = renderToStaticMarkup(
      <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <RootLayout />
          </MemoryRouter>
        </QueryClientProvider>
      </AuthProvider>,
    )
    expect(html).toMatch(/<footer[\s\S]*href="\/terms"[\s\S]*<\/footer>/)
    expect(html).toMatch(/<footer[\s\S]*href="\/privacy"[\s\S]*<\/footer>/)
    expect(html).toMatch(/<footer[\s\S]*href="\/refund"[\s\S]*<\/footer>/)
    expect(html).toContain(i18n.t('footer.cookieSettings'))
    expect(html).not.toContain(i18n.t('consent.title'))
  })

  it('the footer links to the pricing section only while there is a price table to link to', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const render = (seed?: (client: QueryClient) => void) => {
      const client = new QueryClient()
      seed?.(client)
      return renderToStaticMarkup(
        <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
          <QueryClientProvider client={client}>
            <MemoryRouter>
              <RootLayout />
            </MemoryRouter>
          </QueryClientProvider>
        </AuthProvider>,
      )
    }
    const withPrices = render((client) =>
      client.setQueryData(paymentKeys.catalogProducts('SUBSCRIPTION'), {
        currency: 'KRW',
        products: [
          {
            code: 'standard',
            kind: 'SUBSCRIPTION',
            level: 2,
            highlighted: false,
            sortOrder: 1,
            texts: { ko: { name: '스탠다드', description: null } },
            prices: [
              {
                code: 's-m',
                period: 'P1M',
                amount: 6900,
                currency: 'KRW',
                compareAtAmount: null,
                saleEndsAt: null,
              },
            ],
          },
        ],
      }),
    )
    expect(withPrices).toContain('href="/#pricing"')
    expect(render()).not.toContain('href="/#pricing"')
    expect(render()).toContain('href="/#faq"')
  })

  it('a signed-out visitor has a sign-in link in the header', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const html = renderToStaticMarkup(
      <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <RootLayout />
          </MemoryRouter>
        </QueryClientProvider>
      </AuthProvider>,
    )
    expect(html).toMatch(new RegExp(`<a[^>]*href="/login"[^>]*>${i18n.t('header.signIn')}</a>`))
  })
})

describe('RootLayout (signed in): operator menu', () => {
  const renderAs = (permissions: string[] | undefined, at = '/') => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const session = createAuthSession({ api, store: createTokenStore() })
    if (permissions)
      session.signIn({
        accessToken: 'tok',
        tokenType: 'Bearer',
        expiresAt: '2099-01-01T00:00:00Z',
        principal: { accountId: 'a', roles: ['X'], permissions },
      })
    return renderToStaticMarkup(
      <AuthProvider session={session}>
        <MemoryRouter initialEntries={[at]}>
          <AdminLinks />
        </MemoryRouter>
      </AuthProvider>,
    )
  }
  it('shows each operator screen only to someone holding its read permission', () => {
    const all = renderAs(['*'])
    expect(all).toContain('href="/admin/payments"')
    expect(all).toContain('href="/admin/accounts"')
    const cs = renderAs(['payment.read', 'payment.refund'])
    expect(cs).toContain('href="/admin/payments"')
    expect(cs).not.toContain('href="/admin/accounts"')
    expect(all).toContain('href="/admin/roles"')
    expect(cs).not.toContain('href="/admin/roles"')
    const support = renderAs(['account.read'])
    expect(support).toContain('href="/admin/accounts"')
    expect(support).not.toContain('href="/admin/payments"')
  })
  it('shows the API keys screen only to someone holding api-key.read', () => {
    expect(renderAs(['*'])).toContain('href="/admin/api-keys"')
    expect(renderAs(['api-key.read'])).toContain('href="/admin/api-keys"')
    expect(renderAs(['account.read'])).not.toContain('href="/admin/api-keys"')
  })
  it('shows the products and prices screen only to someone holding catalog.manage', () => {
    expect(renderAs(['*'])).toContain('href="/admin/catalog"')
    expect(renderAs(['catalog.manage'])).toContain('href="/admin/catalog"')
    // 결제 보기 권한만으로는 상품 · 가격을 바꿀 수 없다
    expect(renderAs(['payment.read'])).not.toContain('href="/admin/catalog"')
  })
  it('shows each rewards operator screen only to someone holding its permission', () => {
    const all = renderAs(['*'])
    for (const href of ['campaigns', 'coupons', 'points', 'reward-grants'])
      expect(all).toContain(`href="/admin/${href}"`)
    const coupons = renderAs(['coupon.manage'])
    expect(coupons).toContain('href="/admin/coupons"')
    for (const href of ['campaigns', 'points', 'reward-grants'])
      expect(coupons).not.toContain(`href="/admin/${href}"`)
    expect(renderAs(['reward.operate'])).toContain('href="/admin/reward-grants"')
    // 친구 초대 내역은 이벤트 운영(campaign.manage)과 같은 권한이다
    expect(all).toContain('href="/admin/referrals"')
    expect(renderAs(['campaign.manage'])).toContain('href="/admin/referrals"')
    expect(coupons).not.toContain('href="/admin/referrals"')
  })
  it('groups the operator links under one 운영 button (the row of links covered the sign-out and language buttons) - the links stay in the document', () => {
    const all = renderAs(['*'])
    expect(all.match(/<button[^>]*aria-expanded="false"[^>]*>[^<]*운영/g)).toHaveLength(1)
    expect(all.match(/href="\/admin\//g)?.length).toBeGreaterThanOrEqual(8)
    // 운영 화면이 하나도 없으면 단추도 없다
    expect(renderAs([])).not.toContain('aria-expanded')
  })
  it('the 운영 button says it is the current place on an operator screen (aria-current), and not elsewhere', () => {
    expect(renderAs(['*'], '/admin/coupons')).toMatch(
      /<button[^>]*aria-current="true"[^>]*>[^<]*운영/,
    )
    expect(renderAs(['*'], '/notes')).not.toContain('aria-current="true"')
  })
  it('shows nothing to a member without permissions or to a visitor, whatever the role name is', () => {
    expect(renderAs([])).not.toContain('/admin/')
    expect(renderAs(undefined)).not.toContain('/admin/')
  })
})
