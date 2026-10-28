import { AuthProvider, createAuthSession, createTokenStore, type AuthApi } from '@skeleton/auth'
import { paymentKeys, type Catalog } from '@skeleton/payment'
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
  cancelDeletion: unused,
}

const price = (code: string, period: string, amount: number, currency: string) => ({
  code,
  period,
  amount,
  currency,
  compareAtAmount: null,
  saleEndsAt: null,
})
/** 서버가 방문 나라로 통화를 정해 보낸 카탈로그(금액은 최소 단위) */
const catalogIn = (currency: 'KRW' | 'USD'): Catalog => ({
  currency,
  products: [
    {
      code: 'standard',
      kind: 'SUBSCRIPTION',
      level: 2,
      highlighted: true,
      sortOrder: 1,
      texts: {
        ko: { name: '스탠다드', description: null },
        en: { name: 'Standard', description: null },
      },
      prices:
        currency === 'KRW'
          ? [price('s-m', 'P1M', 6900, 'KRW'), price('s-y', 'P1Y', 69000, 'KRW')]
          : [price('s-m', 'P1M', 699, 'USD'), price('s-y', 'P1Y', 6900, 'USD')],
    },
  ],
})

function page(signedIn: boolean, catalog: Catalog | null = catalogIn('KRW')) {
  const store = createTokenStore()
  if (signedIn) store.set('header.payload.signature')
  const client = new QueryClient()
  if (catalog) client.setQueryData(paymentKeys.catalogProducts('SUBSCRIPTION'), catalog)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
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
    expect(html).toContain('href="#pricing"')
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

  it('the landing draws in English when the language is English (every visible text comes from the dictionary)', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = page(false, catalogIn('USD'))
    expect(html).toContain(i18n.t('landing.title'))
    expect(html).toContain('Standard')
    expect(html).toContain('$6.99')
    expect(html).not.toContain('₩')
  })

  it('the currency is the one the server chose for the visitor, whatever the screen language: won for a Korean visitor, dollars for a US one reading Korean', () => {
    expect(page(false, catalogIn('KRW'))).toContain('₩6,900')
    const usOnKorean = page(false, catalogIn('USD'))
    expect(usOnKorean).toContain('$6.99')
    expect(usOnKorean).not.toContain('₩')
  })

  it('the pricing table lists the free card first and then the catalog product, with the dictionary feature list', () => {
    const html = page(false)
    expect(html.indexOf(i18n.t('landing.plan.free.name'))).toBeLessThan(html.indexOf('스탠다드'))
    expect(html).toContain(i18n.t('landing.pricing.features.standard.1'))
  })

  it('while the catalog is loading or could not be read there is no pricing section and no link to it', () => {
    const html = page(false, null)
    expect(html).not.toContain(i18n.t('landing.pricing.title'))
    expect(html).not.toContain('href="#pricing"')
    expect(html).toContain(i18n.t('landing.faq.title'))
  })
})
