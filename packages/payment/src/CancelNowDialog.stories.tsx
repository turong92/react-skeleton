import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { CancelNowDialog } from './CancelNowDialog'
import { koPaymentLabels } from './labels'
import type { CancelPreview } from './subscriptionTypes'

/**
 * 지금 해지하고 환불받기 확인 창 - 확인하기 전에 **환불 예정 금액과 계산 내역**(낸 금액 - 이용한 만큼 - 위약금)을 보인다.
 * 철회 기간 안이면 전액이라고 말하고, 금액을 읽기 전에는 「지금 해지하고 환불받기」가 잠긴다. 닫는 단추는 「취소」가 아니라 「닫기」(처음 포커스).
 */
const preview: CancelPreview = {
  open: true,
  refund: { amount: 3393, currency: 'KRW' },
  withdrawal: false,
  lines: [
    { code: 'PAID', amount: 3900 },
    { code: 'USED', amount: -130 },
    { code: 'PENALTY', amount: -377 },
  ],
}
const onConfirm = fn()
const meta = {
  title: 'Packages/payment/CancelNowDialog',
  component: CancelNowDialog,
  args: {
    open: true,
    onClose: fn(),
    onConfirm,
    preview,
    labels: koPaymentLabels,
    locale: 'ko-KR',
  },
  beforeEach: () => onConfirm.mockClear(),
} satisfies Meta<typeof CancelNowDialog>
export default meta
type Story = StoryObj<typeof meta>

const dialogName = '지금 해지하고 환불받을까요?'

export const ShowsTheRefundAndItsCalculation: Story = {
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('환불 예정 금액')
    await expect(dialog).toHaveTextContent('3,393원')
    await expect(dialog).toHaveTextContent('-377원')
    await userEvent.click(within(dialog).getByRole('button', { name: '지금 해지하고 환불받기' }))
    await expect(onConfirm).toHaveBeenCalledOnce()
  },
}

export const WithdrawalPeriodRefundsEverything: Story = {
  args: {
    preview: {
      open: true,
      refund: { amount: 3900, currency: 'KRW' },
      withdrawal: true,
      lines: [{ code: 'PAID', amount: 3900 }],
    },
  },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('철회 기간 안이라 낸 금액을 모두 돌려드려요')
  },
}

export const LockedUntilTheRefundIsRead: Story = {
  args: { preview: undefined, previewLoading: true },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('환불 금액을 확인하는 중')
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: '지금 해지하고 환불받기' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    )
  },
}
