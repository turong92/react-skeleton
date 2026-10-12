import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { koPaymentLabels } from '../labels'
import { CloseSubscriptionChargeDialog } from './CloseSubscriptionChargeDialog'

/**
 * 막힌 구독 결제를 「결제 안 됨」으로 닫는 확인 창 - 결제사가 끝내 답하지 않은 구독 결제만. 서버가 닫기 전에 결제사에 한 번 더 묻고, 결제된 것으로 나오면 닫지 않고 결제됨으로 맞춘다.
 * 처음 포커스는 「닫기」(실수로 Enter 를 눌러도 닫히지 않는다). 닫을 수 없는 결제(409)는 그 말을, 그 밖은 일반 문구를 창 안에 띄운다.
 */
const onConfirm = fn()
const onClose = fn()
const meta = {
  title: 'Packages/payment/admin/CloseSubscriptionChargeDialog',
  component: CloseSubscriptionChargeDialog,
  args: { open: true, onClose, onConfirm, labels: koPaymentLabels },
  beforeEach: () => {
    onConfirm.mockClear()
    onClose.mockClear()
  },
} satisfies Meta<typeof CloseSubscriptionChargeDialog>
export default meta
type Story = StoryObj<typeof meta>

const dialogName = '이 결제를 「결제 안 됨」으로 닫을까요?'

export const ConfirmSendsOnce: Story = {
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '닫기' })).toHaveFocus())
    await expect(dialog).toHaveTextContent('한 번 더 물어보고')
    await userEvent.click(within(dialog).getByRole('button', { name: '결제 안 됨으로 닫기' }))
    await expect(onConfirm).toHaveBeenCalledOnce()
  },
}
