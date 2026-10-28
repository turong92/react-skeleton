import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { koPaymentLabels } from '../labels'
import { AdminCatalogTable } from './AdminCatalogTable'
import type { AdminCatalogPrice, AdminCatalogProduct } from './catalogAdminTypes'

/**
 * 운영자 상품 목록(`@skeleton/payment/admin`) - 줄마다 이름(화면 언어) · 코드 · 종류 · 등급 · 판매 상태 · 지금 팔리는 가격(통화별), 줄 끝 테두리 「자세히」.
 * 보이기만 한다(데이터 · 호출은 부모). 판매 중지한 상품도 보인다. `renderAction` 으로 라우터 링크를 꽂는다(버튼 모양 클래스가 건네진다).
 */
const price = (over: Partial<AdminCatalogPrice>): AdminCatalogPrice => ({
  code: 'p',
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
const product = (over: Partial<AdminCatalogProduct>): AdminCatalogProduct => ({
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
  prices: [
    price({ code: 'std-m' }),
    price({ code: 'std-y', period: 'P1Y', amount: 59000, compareAtAmount: 69000 }),
  ],
  ...over,
})
const products = [
  product({
    code: 'basic',
    level: 1,
    texts: { ko: { name: '베이직', description: null } },
    prices: [price({ code: 'b-m', amount: 3900 })],
  }),
  product({ highlighted: true }),
  product({
    code: 'legacy',
    level: 3,
    selling: false,
    texts: { ko: { name: '옛 프로', description: null } },
    prices: [
      price({ code: 'l-m', current: false, selling: false, stoppedAt: '2026-10-02T00:00:00Z' }),
    ],
  }),
]

const onOpen = fn()
const meta = {
  title: 'Packages/payment/admin/AdminCatalogTable',
  component: AdminCatalogTable,
  args: { products, onOpen, locale: 'ko-KR', labels: koPaymentLabels },
  beforeEach: () => onOpen.mockClear(),
} satisfies Meta<typeof AdminCatalogTable>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('table', { name: '상품 목록' })).toBeVisible()
    await expect(canvas.getByText('59,000원 · 연간')).toBeVisible()
    await expect(canvas.getByText('인기')).toBeVisible()
    await expect(canvas.getByText('팔 수 있는 가격 없음')).toBeVisible()
    const details = canvas.getByRole('button', { name: '자세히: 베이직' })
    await expect(details).toHaveAttribute('data-variant', 'secondary')
    await userEvent.click(details)
    await expect(onOpen).toHaveBeenCalledWith(products[0])
  },
}

export const Empty: Story = {
  args: { products: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('아직 상품이 없어요')).toBeVisible()
  },
}

export const FailedToLoad: Story = {
  args: { products: [], error: true, onRetry: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: koPaymentLabels.list.retry }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}
