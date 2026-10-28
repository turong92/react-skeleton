import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { CancelScheduledChangeDialog } from './CancelScheduledChangeDialog'
import { koPaymentLabels } from './labels'

/**
 * 예약된 플랜 변경을 거두는 확인 창 - 어느 플랜으로 언제 바뀔 예정이었는지, 거두면 지금 플랜 그대로라고 먼저 말한다.
 * 처음 포커스는 「닫기」. 실패하면 이유와 참조 번호를 창 안에 띄운다.
 */
const onConfirm = fn()
const meta = {
  title: 'Packages/payment/CancelScheduledChangeDialog',
  component: CancelScheduledChangeDialog,
  args: {
    open: true,
    onClose: fn(),
    onConfirm,
    scheduledChange: { planName: 'Basic', effectiveAt: '2026-11-01T03:00:00Z' },
    labels: koPaymentLabels,
    locale: 'ko-KR',
    formatTime: () => '11월 1일',
  },
  beforeEach: () => onConfirm.mockClear(),
} satisfies Meta<typeof CancelScheduledChangeDialog>
export default meta
type Story = StoryObj<typeof meta>

const dialogName = '예약된 플랜 변경을 거둘까요?'

export const ConfirmSendsOnce: Story = {
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '닫기' })).toHaveFocus())
    await expect(dialog).toHaveTextContent('11월 1일부터 Basic(으)로 바뀔 예정이었어요')
    await expect(dialog).toHaveTextContent('지금 플랜 그대로 이어져요')
    await userEvent.click(within(dialog).getByRole('button', { name: '예약 거두기' }))
    await expect(onConfirm).toHaveBeenCalledOnce()
  },
}

export const Failed: Story = {
  args: { error: new Error('boom') },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('예약을 거두지 못했어요')
  },
}
