import {
  catalogAdminKeys,
  type AdminCatalogPrice,
  type AdminCatalogProduct,
} from '@skeleton/payment/admin'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { OperatorSession } from '../test-support/operatorSession'
import { AdminCatalogPage } from './AdminCatalogPage'
import { AdminCatalogProductPage } from './AdminCatalogProductPage'

afterEach(async () => {
  await i18n.setLocale('ko', { remember: false })
})

const price = (over: Partial<AdminCatalogPrice> = {}): AdminCatalogPrice => ({
  code: 'std-m',
  period: 'P1M',
  amount: 6900,
  currency: 'KRW',
  compareAtAmount: null,
  saleStartsAt: null,
  saleEndsAt: null,
  selling: true,
  current: true,
  stoppedAt: null,
  providerRefs: {},
  ...over,
})
const product = (over: Partial<AdminCatalogProduct> = {}): AdminCatalogProduct => ({
  code: 'standard',
  kind: 'SUBSCRIPTION',
  level: 2,
  highlighted: false,
  selling: true,
  sortOrder: 2,
  texts: {
    ko: { name: '스탠다드', description: null },
    en: { name: 'Standard', description: null },
  },
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  prices: [price()],
  ...over,
})

function render(url: string, seed: (client: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } })
  seed(client)
  return renderToStaticMarkup(
    <OperatorSession>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/admin/catalog" element={<AdminCatalogPage />} />
            <Route path="/admin/catalog/:code" element={<AdminCatalogProductPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </OperatorSession>,
  )
}
const seedProducts =
  (...products: AdminCatalogProduct[]) =>
  (client: QueryClient) => {
    client.setQueryData(catalogAdminKeys.products(), products)
    client.setQueryData(catalogAdminKeys.providers(), [])
  }

describe('AdminCatalogPage (/admin/catalog)', () => {
  it('lists the products with a filled 「상품 만들기」 and, per row, a real link to the product that looks pressable', () => {
    const html = render('/admin/catalog', seedProducts(product()))
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('스탠다드')
    expect(html).toContain('6,900원 · 월간')
    expect(html).toMatch(/data-variant="primary"[^>]*>상품 만들기/)
    expect(html).toMatch(
      /<a (?=[^>]*href="\/admin\/catalog\/standard")(?=[^>]*aria-label="자세히: 스탠다드")[^>]*>/,
    )
    expect(html).toMatch(/<a [^>]*class="[^"]*actionLink/)
  })

  it('names the product in the language of the screen', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render('/admin/catalog', seedProducts(product()))
    expect(html).toContain('Standard')
    expect(html).toContain('Products &amp; prices')
  })
})

describe('AdminCatalogProductPage (/admin/catalog/:code)', () => {
  it('shows the product form, the price table and the way back', () => {
    const html = render('/admin/catalog/standard', seedProducts(product()))
    expect(html).toContain('상품 정보')
    expect(html).toContain('value="스탠다드"')
    expect(html).toContain('KRW 가격')
    expect(html).toMatch(/data-variant="primary"[^>]*>가격 더하기/)
    expect(html).toMatch(/href="\/admin\/catalog"[^>]*>상품 목록/)
    // 판매 중인 가격에는 멈추는 단추가 있다
    expect(html).toContain('aria-label="판매 중지: std-m"')
  })

  it('a code that is not in the list says so and leads back', () => {
    const html = render('/admin/catalog/nope', seedProducts(product()))
    expect(html).toContain('찾는 상품이 없어요')
    expect(html).toMatch(/href="\/admin\/catalog"/)
  })

  it('provider link cells appear only when the server lists a provider', () => {
    const seed = (client: QueryClient) => {
      client.setQueryData(catalogAdminKeys.products(), [product()])
      client.setQueryData(catalogAdminKeys.providers(), ['paddle'])
    }
    expect(render('/admin/catalog/standard', seed)).toContain('Paddle 가격 id (std-m)')
    expect(render('/admin/catalog/standard', seedProducts(product()))).not.toContain(
      'Paddle 가격 id',
    )
  })
})
