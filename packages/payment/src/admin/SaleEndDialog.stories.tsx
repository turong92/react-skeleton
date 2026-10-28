import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, within } from 'storybook/test'
import { koPaymentLabels } from '../labels'
import { SaleEndDialog } from './SaleEndDialog'

/**
 * 행사가의 끝나는 시각만 바꾸는 창 - 지금 끝 시각이 채워져 있고, 비우고 보내면 끝 없이 이어진다(`null`).
 * 시작보다 이른 끝은 칸 아래에서 말하고 보내지 않는다.
 */
const onSubmit = fn()
const meta = {
  title: 'Packages/payment/admin/SaleEndDialog',
  component: SaleEndDialog,
  args: {
    open: true,
    onClose: fn(),
    onSubmit,
    price: {
      code: 'std-y',
      amount: 59000,
      currency: 'KRW',
      saleStartsAt: '2026-11-01T00:00:00Z',
      saleEndsAt: '2026-11-30T12:00:00Z',
    },
    locale: 'ko-KR',
    labels: koPaymentLabels,
  },
  beforeEach: () => onSubmit.mockClear(),
} satisfies Meta<typeof SaleEndDialog>
export default meta
type Story = StoryObj<typeof meta>

const dialogName = '행사 기간 바꾸기'

export const ClearTheEnd: Story = {
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('std-y · 59,000원')
    const end = within(dialog).getByLabelText('끝나는 시각')
    await userEvent.clear(end)
    const submit = within(dialog).getByRole('button', { name: '바꾸기' })
    await expect(submit).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(submit)
    await expect(onSubmit).toHaveBeenCalledWith(null)
  },
}

export const EndBeforeStartIsNotSent: Story = {
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    const end = within(dialog).getByLabelText('끝나는 시각')
    await userEvent.clear(end)
    await userEvent.type(end, '2020-01-01T09:00')
    await userEvent.click(within(dialog).getByRole('button', { name: '바꾸기' }))
    await expect(within(dialog).getByText('끝나는 시각이 시작 시각보다 늦어야 해요')).toBeVisible()
    await expect(onSubmit).not.toHaveBeenCalled()
  },
}
