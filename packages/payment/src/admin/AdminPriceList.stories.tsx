import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, within } from 'storybook/test'
import { koPaymentLabels } from '../labels'
import { AdminPriceList } from './AdminPriceList'
import type { AdminCatalogPrice } from './catalogAdminTypes'

/**
 * 상품의 가격 표(`@skeleton/payment/admin`) - 통화별로 묶어 지금 · 예정 · 지난 가격을 최신 먼저. 줄마다 금액(행사면 정가 + 기간) · 상태 알약 · 테두리 「판매 중지」.
 * 가격 줄은 고치지 않는다 - 바꾸려면 새 가격을 더하고 이전 것은 멈춘다. 결제사 링크 칸은 서버가 가격 id 를 쓰는 결제사를 알려 줄 때만 생긴다.
 */
const price = (over: Partial<AdminCatalogPrice>): AdminCatalogPrice => ({
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
const now = new Date('2026-11-01T00:00:00Z')
const prices = [
  price({
    code: 'std-y-sale',
    period: 'P1Y',
    amount: 59000,
    compareAtAmount: 69000,
    saleStartsAt: '2026-10-30T00:00:00Z',
    saleEndsAt: '2026-11-02T00:00:00Z',
  }),
  price({ code: 'std-y', period: 'P1Y', amount: 69000, current: false }),
  price({ code: 'std-m' }),
  price({
    code: 'std-m-old',
    amount: 4900,
    current: false,
    selling: false,
    stoppedAt: '2026-09-01T00:00:00Z',
  }),
  price({ code: 'std-m-usd', currency: 'USD', amount: 699, providerRefs: { paddle: 'pri_01' } }),
  price({ code: 'std-y-usd', period: 'P1Y', currency: 'USD', amount: 6990 }),
]

const onAdd = fn()
const onStop = fn()
const onChangeSale = fn()
const onSet = fn()
const onRemove = fn()
const meta = {
  title: 'Packages/payment/admin/AdminPriceList',
  component: AdminPriceList,
  args: {
    prices,
    now,
    onAdd,
    onStop,
    onChangeSale,
    locale: 'ko-KR',
    formatTime: (iso: string) => iso.slice(0, 10),
    labels: koPaymentLabels,
  },
  beforeEach: () => {
    for (const mock of [onAdd, onStop, onChangeSale, onSet, onRemove]) mock.mockClear()
  },
} satisfies Meta<typeof AdminPriceList>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('table', { name: 'KRW 가격' })).toBeVisible()
    await expect(canvas.getByRole('table', { name: 'USD 가격' })).toBeVisible()
    await expect(canvas.getByText('정가 69,000원')).toBeVisible()
    await expect(canvas.getByText('2026-11-02까지')).toBeVisible()
    await expect(canvas.getByText('행사가에 가려짐')).toBeVisible()
    await expect(canvas.getAllByText('판매 중지').length).toBeGreaterThan(0)
    const add = canvas.getByRole('button', { name: '가격 더하기' })
    await expect(add).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(add)
    await expect(onAdd).toHaveBeenCalledOnce()
    // 멈춘 가격에는 멈추는 단추가 없다
    await expect(canvas.queryByRole('button', { name: '판매 중지: std-m-old' })).toBeNull()
    const stop = canvas.getByRole('button', { name: '판매 중지: std-m' })
    await expect(stop).toHaveAttribute('data-variant', 'secondary')
    await userEvent.click(stop)
    await expect(onStop).toHaveBeenCalledWith(prices[2])
  },
}

/** 행사가 줄에만 「행사 기간 바꾸기」 - 눌리는 테두리 단추 */
export const ChangeSalePeriod: Story = {
  play: async ({ canvas, userEvent }) => {
    const change = canvas.getByRole('button', { name: '행사 기간 바꾸기: std-y-sale' })
    await expect(change).toHaveAttribute('data-variant', 'secondary')
    await expect(canvas.queryByRole('button', { name: '행사 기간 바꾸기: std-m' })).toBeNull()
    await userEvent.click(change)
    await expect(onChangeSale).toHaveBeenCalledWith(prices[0])
  },
}

export const WithProviderLinks: Story = {
  args: {
    providers: ['paddle'],
    providerCurrencies: { paddle: ['USD'] },
    onSetProviderRef: onSet,
    onRemoveProviderRef: onRemove,
  },
  play: async ({ canvas, userEvent }) => {
    const linked = canvas.getByRole('textbox', { name: 'Paddle 가격 id (std-m-usd)' })
    await expect(linked).toHaveValue('pri_01')
    // 같은 값이면 「연결」은 잠겨 있다
    await expect(canvas.getByRole('button', { name: '연결: Paddle (std-m-usd)' })).toBeDisabled()
    // 끊기 전에 한 번 묻는다
    await userEvent.click(canvas.getByRole('button', { name: '연결 끊기: Paddle (std-m-usd)' }))
    const dialog = await screen.findByRole('dialog', { name: '결제사 가격 연결을 끊을까요?' })
    await expect(onRemove).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: '연결 끊기' }))
    await expect(onRemove).toHaveBeenCalledWith(prices[4], 'paddle')
    // 원화 줄에는 링크 칸이 없다
    await expect(canvas.queryByRole('textbox', { name: 'Paddle 가격 id (std-m)' })).toBeNull()
    const empty = canvas.getByRole('textbox', { name: 'Paddle 가격 id (std-y-usd)' })
    await userEvent.type(empty, 'pri_new')
    await userEvent.click(canvas.getByRole('button', { name: '연결: Paddle (std-y-usd)' }))
    await expect(onSet).toHaveBeenCalledWith(prices[5], 'paddle', 'pri_new')
  },
}

export const NoPricesYet: Story = {
  args: { prices: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('아직 가격이 없어요. 가격을 더하면 팔 수 있어요.')).toBeVisible()
  },
}
