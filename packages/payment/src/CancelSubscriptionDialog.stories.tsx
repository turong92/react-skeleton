import { ApiRequestError } from '@skeleton/api-client'
import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog'
import { koPaymentLabels } from './labels'
import { subscription } from './test/fixtures'

/**
 * 해지 확인 창 — 이용 중이면 「○○까지 계속 이용할 수 있고, 그 뒤에는 결제되지 않아요」, 결제 다시 시도 중(`PAST_DUE`)이면 「바로 끝나요」.
 * 확인은 「해지 예약하기」, 닫는 단추는 「취소」가 아니라 「닫기」(처음 포커스, 실수로 Enter 를 눌러도 해지되지 않는다). Esc 로 닫힌다.
 * 해지가 실패하면 이유를 창 안에 띄우고 참조 번호를 붙인다.
 */
const onConfirm = fn()
const onClose = fn()
const meta = {
  title: 'Packages/payment/CancelSubscriptionDialog',
  component: CancelSubscriptionDialog,
  args: {
    open: false,
    onClose,
    onConfirm,
    subscription: subscription(),
    labels: koPaymentLabels,
    locale: 'ko-KR',
    formatTime: () => '2026. 11. 1.',
  },
  beforeEach: () => {
    onConfirm.mockClear()
    onClose.mockClear()
  },
} satisfies Meta<typeof CancelSubscriptionDialog>
export default meta
type Story = StoryObj<typeof meta>

function Demo(props: Partial<ComponentProps<typeof CancelSubscriptionDialog>>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        기간 끝에 해지
      </Button>
      <CancelSubscriptionDialog
        {...(meta.args as ComponentProps<typeof CancelSubscriptionDialog>)}
        {...props}
        open={open}
        onClose={() => {
          onClose()
          setOpen(false)
        }}
        onConfirm={() => {
          onConfirm()
          setOpen(false)
        }}
      />
    </>
  )
}

const dialogName = '해지를 예약할까요?'

export const ConfirmSendsOnce: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '기간 끝에 해지' }))
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '닫기' })).toHaveFocus())
    await expect(dialog).toHaveTextContent('2026. 11. 1.까지 계속 이용할 수 있고')
    const confirm = within(dialog).getByRole('button', { name: '해지 예약하기' })
    await userEvent.click(confirm)
    await expect(onConfirm).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  },
}

export const CloseSendsNothing: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '기간 끝에 해지' }))
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await expect(onConfirm).not.toHaveBeenCalled()
    await expect(onClose).toHaveBeenCalled()
    // 연 단추로 포커스가 돌아온다
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: '기간 끝에 해지' })).toHaveFocus(),
    )
  },
}

export const PastDueEndsRightAway: Story = {
  args: { open: true, subscription: subscription({ status: 'PAST_DUE' }) },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('지금 해지하면 바로 끝나요')
  },
}

export const Busy: Story = {
  args: { open: true, busy: true },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(within(dialog).getByRole('button', { name: '닫기' })).toBeDisabled()
    await expect(within(dialog).getByRole('button', { name: /해지 예약하기/ })).toBeDisabled()
  },
}

export const ErrorShowsReference: Story = {
  args: {
    open: true,
    error: new ApiRequestError(
      {
        code: 'COMMON.INTERNAL',
        title: 't',
        status: 500,
        timestamp: '2026-01-01T00:00:00Z',
        traceId: 'trace-7',
      },
      'trace-7',
      'sp',
      'tp',
    ),
  },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent('해지를 예약하지 못했어요')
    await expect(within(dialog).getByText('trace-7')).toBeVisible()
    // 다시 눌러 볼 수 있다
    await expect(within(dialog).getByRole('button', { name: '해지 예약하기' })).toBeEnabled()
  },
}
