import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { HoldPanel } from './HoldPanel'
import { koBookingLabels } from './labels'
import type { HoldSnapshot } from './holdController'
import type { Hold } from './types'

const hold = (over: Partial<Hold> = {}): Hold => ({
  holdId: 'hold-1',
  poolId: 'pool-1',
  status: 'HELD',
  expiresAt: '2999-01-01T00:00:00Z',
  amount: 100_000,
  seats: [
    {
      id: 'A1',
      section: 'A',
      row: '1',
      number: 1,
      grade: 'R',
      price: 50_000,
      state: 'TAKEN',
      v: 2,
    },
    {
      id: 'A2',
      section: 'A',
      row: '1',
      number: 2,
      grade: 'R',
      price: 50_000,
      state: 'TAKEN',
      v: 2,
    },
  ],
  ...over,
})
const state = (over: Partial<HoldSnapshot> = {}): HoldSnapshot => ({
  hold: hold(),
  pending: [],
  busy: false,
  locked: false,
  problem: null,
  error: null,
  ...over,
})

/**
 * 내 보류 - 고른 자리 · 금액 · 남은 시간(0 이 되면 확정 · 결제가 잠기고 풀렸다고 알린다) · 무료는 「예약 확정」, 유료는 「결제하기」(결제를 시작하면 자리를 고정하고 결제 자리가 열린다) · 「나가기」는 늘 있다.
 * 결제창은 앱이 `renderPayment` 로 끼운다.
 */
const meta = {
  title: 'Packages/booking/HoldPanel',
  component: HoldPanel,
  parameters: { layout: 'padded' },
  args: {
    hold: state(),
    remainingMs: 125_000,
    currency: 'KRW',
    locale: 'ko-KR',
    labels: koBookingLabels,
    onCheckout: fn(),
    onConfirm: fn(),
    onLeave: fn(),
  },
} satisfies Meta<typeof HoldPanel>
export default meta
type Story = StoryObj<typeof meta>

export const PaidHoldShowsTimeAndTotal: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('timer')).toHaveTextContent('남은 시간 2:05')
    await expect(canvas.getByText(/₩100,000/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '결제하기' }))
    await expect(args.onCheckout).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole('button', { name: '나가기' }))
    await expect(args.onLeave).toHaveBeenCalledTimes(1)
  },
}

export const FreeHoldConfirms: Story = {
  args: { hold: state({ hold: hold({ amount: undefined }) }) },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '예약 확정' }))
    await expect(args.onConfirm).toHaveBeenCalledTimes(1)
    await expect(canvas.queryByRole('button', { name: '결제하기' })).toBeNull()
  },
}

export const TheButtonsLockWhenTheTimeIsUp: Story = {
  args: { remainingMs: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('시간이 지나 자리가 풀렸어요.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '결제하기' })).toBeDisabled()
  },
}

export const AfterCheckoutTheSeatsAreFixedAndLeavingStaysOpen: Story = {
  args: {
    hold: state({ locked: true }),
    renderPayment: ({ amount }) => <p>결제창 자리 {amount}</p>,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/결제를 시작해서 자리를 바꿀 수 없어요/)).toBeVisible()
    await expect(canvas.getByText('결제창 자리 100000')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '결제하기' })).toBeNull()
    await expect(canvas.getByRole('button', { name: '나가기' })).toBeEnabled()
  },
}

export const ConfirmedBooking: Story = {
  args: { hold: state({ hold: hold({ status: 'CONFIRMED' }) }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('예약이 확정됐어요.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '나가기' })).toBeNull()
  },
}

export const SaysWhyARequestFailed: Story = {
  args: { hold: state({ problem: 'seatTaken' }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('다른 분이 먼저 잡았어요.')).toBeVisible()
  },
}
