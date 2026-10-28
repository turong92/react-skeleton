import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from '../labels'
import { AdminCatalogTable } from './AdminCatalogTable'
import type { AdminCatalogPrice, AdminCatalogProduct } from './catalogAdminTypes'
import { productTextOf } from './catalogText'

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
  highlighted: true,
  selling: true,
  sortOrder: 1,
  texts: {
    ko: { name: '스탠다드', description: null },
    en: { name: 'Standard', description: null },
  },
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  prices: [price(), price({ code: 'std-y', period: 'P1Y', amount: 59000, current: true })],
  ...over,
})
const render = (props: object = {}) =>
  renderToStaticMarkup(
    <AdminCatalogTable
      products={[product()]}
      locale="ko-KR"
      labels={koPaymentLabels}
      onOpen={() => undefined}
      {...props}
    />,
  )

describe('AdminCatalogTable', () => {
  it('a row has the name in the screen language, the code, the kind, the level, the status in words and every price on sale now', () => {
    const html = render()
    expect(html).toContain('스탠다드')
    expect(html).toContain('standard')
    expect(html).toContain('구독')
    expect(html).toContain('판매 중')
    expect(html).toContain('인기')
    expect(html).toContain('6,900원 · 월간')
    expect(html).toContain('59,000원 · 연간')
  })

  it('prices that are not on sale now (stopped, scheduled) are not in the summary', () => {
    const html = render({
      products: [product({ prices: [price({ current: false, selling: false })] })],
    })
    expect(html).not.toContain('6,900원')
    expect(html).toContain('팔 수 있는 가격 없음')
  })

  it('a stopped product says so; the 「자세히」 button names its product and is a filled-border button', () => {
    const html = render({ products: [product({ selling: false })] })
    expect(html).toContain('판매 중지')
    expect(html).toMatch(
      /data-variant="secondary"[^>]*aria-label="자세히: 스탠다드"|aria-label="자세히: 스탠다드"[^>]*data-variant="secondary"/,
    )
  })

  it('no products: an empty state, not an empty table', () => {
    const html = render({ products: [] })
    expect(html).toContain('아직 상품이 없어요')
    expect(html).not.toContain('<table')
  })

  it('a router link can replace the button and receives the button-like class', () => {
    const html = render({
      onOpen: undefined,
      renderAction: (p: AdminCatalogProduct, label: string, name: string, cls: string) => (
        <a href={`/admin/catalog/${p.code}`} className={cls} aria-label={name}>
          {label}
        </a>
      ),
    })
    expect(html).toMatch(/<a href="\/admin\/catalog\/standard" class="[^"]+"/)
  })
})

describe('productTextOf', () => {
  it('falls back to English, then the first language, then the code', () => {
    const p = product()
    expect(productTextOf(p, 'fr-FR').name).toBe('Standard')
    expect(
      productTextOf({ ...p, texts: { ja: { name: 'J', description: null } } }, 'ko').name,
    ).toBe('J')
    expect(productTextOf({ ...p, texts: {} }, 'ko').name).toBe('standard')
  })
})
