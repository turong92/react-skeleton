import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { koPaymentLabels } from './labels'
import { OrderSummary } from './OrderSummary'
import { order, refund } from './test/fixtures'

/**
 * 결제 한 건 — `orderName` 그대로 · 상태 알약 · 금액 · 결제 수단 · 시각 · 환불 줄 · 「환불 요청」(구역의 주 단추 하나).
 * 못 누르는 단추는 **꺼지지 않는다**: `aria-disabled="true"` 로 흐리게 두고, 눌러도 아무 일 없고, Tab 으로 닿고, **왜 못 누르는지 옆에 글자로** 적어
 * `aria-describedby` 로 이어 낭독된다(「환불 중이에요」). 환불할 게 없으면 단추도 없다. 서버 설정(`refundRequestsEnabled`)을 아직 모르면 단추를 그리지 않는다.
 * 내가 요청만 해 둔 환불(`REQUESTED`)에는 줄 옆에 테두리 단추 「요청 거두기」 — 낱말은 「환불 요청함」 → 「환불 요청 거둠」.
 * 대화상자는 부모가 연다 — `RefundRequestDialog`.
 */
const meta = {
  title: 'Packages/payment/OrderSummary',
  component: OrderSummary,
  args: {
    order: order({ orderName: '응원하기 3,000원' }),
    refunds: [],
    onRequestRefund: fn(),
    onWithdrawRefund: fn(),
    refundRequestsEnabled: true,
    labels: koPaymentLabels,
    locale: 'ko-KR',
    formatTime: () => '2026. 1. 1. 오후 12:00',
  },
} satisfies Meta<typeof OrderSummary>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: '응원하기 3,000원' })).toBeVisible()
    await expect(canvas.getByText('결제됨')).toBeVisible()
    await expect(canvas.getByText('현대카드 ····1234')).toBeVisible()
    await expect(canvas.getByText('2026. 1. 1. 오후 12:00')).toBeVisible()
    const request = canvas.getByRole('button', { name: '환불 요청' })
    await expect(request).toBeEnabled()
    await expect(request).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(request)
    await expect(args.onRequestRefund).toHaveBeenCalled()
  },
}

export const RefundAlreadyOpen: Story = {
  args: {
    order: order({ refundPending: true, openRefundStatus: 'PENDING' }),
    refunds: [refund({ status: 'PENDING' })],
  },
  play: async ({ canvas, args, userEvent }) => {
    const request = canvas.getByRole('button', { name: '환불 요청' })
    // 꺼진 단추가 아니다: 포커스가 오고 이유가 낭독된다 — 눌러도 아무 일이 없다
    await expect(request).toHaveAttribute('aria-disabled', 'true')
    await expect(request).not.toBeDisabled()
    await userEvent.tab()
    await expect(request).toHaveFocus()
    await expect(request).toHaveAccessibleDescription('환불 중이에요')
    await expect(canvas.getByText('환불 중이에요')).toBeVisible()
    await userEvent.click(request)
    await userEvent.keyboard('{Enter}')
    await expect(args.onRequestRefund).not.toHaveBeenCalled()
    // 머리 알약과 환불 줄이 같은 말을 한다
    await expect(canvas.getAllByText('환불 중')).toHaveLength(2)
  },
}

/** 요청만 했을 뿐 돈은 안 움직였다 — 알약도 줄도 「환불 요청함」(「환불 중」 아님), 단추 옆 이유는 「이미 환불을 요청했어요」 */
export const RefundOnlyRequested: Story = {
  args: {
    order: order({ refundPending: true, openRefundStatus: 'REQUESTED' }),
    refunds: [refund({ status: 'REQUESTED' })],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('환불 요청함')).toHaveLength(2)
    await expect(canvas.queryByText('환불 중')).toBeNull()
    const request = canvas.getByRole('button', { name: '환불 요청' })
    await expect(request).toHaveAttribute('aria-disabled', 'true')
    await expect(request).toHaveAccessibleDescription('이미 환불을 요청했어요')
  },
}

export const WithdrawMyRequest: Story = {
  args: {
    order: order({ refundPending: true, openRefundStatus: 'REQUESTED' }),
    refunds: [refund({ id: 'rfd_mine', status: 'REQUESTED', origin: 'USER' })],
  },
  play: async ({ canvas, args, userEvent }) => {
    const withdraw = canvas.getByRole('button', { name: '요청 거두기' })
    // 주 단추가 아니다 — 구역의 채운 단추는 「환불 요청」 하나, 이것은 테두리 단추
    await expect(withdraw).toHaveAttribute('data-variant', 'secondary')
    await expect(getComputedStyle(withdraw).borderTopWidth).toBe('1px')
    await expect(
      canvas.getAllByRole('button').filter((b) => b.dataset.variant === 'primary'),
    ).toHaveLength(1)
    await userEvent.click(withdraw)
    await expect(args.onWithdrawRefund).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rfd_mine' }),
    )
  },
}

export const WithdrawIsBusy: Story = {
  args: {
    order: order({ refundPending: true, openRefundStatus: 'REQUESTED' }),
    refunds: [refund({ status: 'REQUESTED' })],
    withdrawing: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /거두는 중/ })).toBeDisabled()
    await expect(canvas.queryByText('Loading')).toBeNull()
  },
}

export const NoWithdrawForRequestsIDidNotMake: Story = {
  args: {
    order: order({ refundPending: true, openRefundStatus: 'REQUESTED' }),
    refunds: [refund({ status: 'REQUESTED', origin: 'OPERATOR' })],
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: '요청 거두기' })).toBeNull()
  },
}

export const WithdrawnRequest: Story = {
  args: { refunds: [refund({ status: 'WITHDRAWN', completedAt: '2026-01-02T03:00:00Z' })] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('환불 요청 거둠')).toBeVisible()
    await expect(canvas.queryByText(/그만둠/)).toBeNull()
    await expect(canvas.getByRole('button', { name: '환불 요청' })).not.toHaveAttribute(
      'aria-disabled',
    )
  },
}

export const RefundsTurnedOff: Story = {
  args: { refundRequestsEnabled: false },
  play: async ({ canvas, userEvent, args }) => {
    const request = canvas.getByRole('button', { name: '환불 요청' })
    await expect(request).toHaveAttribute('aria-disabled', 'true')
    await expect(canvas.getByText('지금은 환불을 요청할 수 없어요')).toBeVisible()
    await userEvent.click(request)
    await expect(args.onRequestRefund).not.toHaveBeenCalled()
  },
}

/** 서버 설정을 아직 모르는 동안은 단추가 없다 — 켜졌다 꺼지는 단추가 보이지 않는다 */
export const ButtonWaitsForTheServerSettings: Story = {
  args: { refundRequestsEnabled: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '응원하기 3,000원' })).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}

export const PartlyRefunded: Story = {
  args: {
    order: order({ status: 'PARTIALLY_REFUNDED', refundedAmount: 1000, refundableAmount: 2000 }),
    refunds: [
      refund({ id: 'rfd_1', status: 'SUCCEEDED', amount: { amount: 1000, currency: 'KRW' } }),
      refund({ id: 'rfd_2', status: 'REJECTED', reasonCode: 'DUPLICATE' }),
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('일부 환불됨')[0]).toBeVisible()
    await expect(canvas.getByRole('region', { name: '환불' })).toBeVisible()
    await expect(canvas.getByText('환불됨')).toBeVisible()
    await expect(canvas.getByText('환불 안 됨')).toBeVisible()
    await expect(canvas.getByText(/같은 결제가 두 번 됐어요/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: '환불 요청' })).toBeEnabled()
  },
}

/** 시스템이 만든 환불 줄(운영자 · 결제사 콘솔)도 사유가 글자로 읽힌다 */
export const RefundsTheSystemMade: Story = {
  args: {
    order: order({ status: 'REFUNDED', refundedAmount: 3000, refundableAmount: 0 }),
    refunds: [
      refund({ id: 'a', status: 'SUCCEEDED', reasonCode: 'OPERATOR', origin: 'OPERATOR' }),
      refund({ id: 'b', status: 'SUCCEEDED', reasonCode: 'PROVIDER_CONSOLE', origin: 'PROVIDER' }),
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/운영자가 환불함/)).toBeVisible()
    await expect(canvas.getByText(/결제사에서 환불됨/)).toBeVisible()
  },
}

export const FullyRefunded: Story = {
  args: {
    order: order({ status: 'REFUNDED', refundedAmount: 3000, refundableAmount: 0 }),
    refunds: [refund({ status: 'SUCCEEDED' })],
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).toBeNull() // 환불할 게 없다
  },
}

export const WithoutCardDetails: Story = {
  args: { order: order({ card: null, method: 'EASY_PAY' }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('간편결제')).toBeVisible()
  },
}

export const TestPayment: Story = {
  args: { order: order({ testMode: true }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('테스트 결제예요. 실제로 돈이 나가지 않아요')).toBeVisible()
  },
}

function Narrow({ width, name }: { width: string; name?: string }) {
  return (
    <div data-testid="frame" style={{ width }}>
      <OrderSummary
        order={order({
          orderName: name ?? '아주 긴 이름의 응원하기 항목 '.repeat(3),
          status: 'PARTIALLY_REFUNDED',
          refundedAmount: 1000,
          refundableAmount: 2000,
          refundPending: true,
          openRefundStatus: 'REQUESTED',
          testMode: true,
        })}
        refunds={[refund({ status: 'REQUESTED' })]}
        onRequestRefund={() => undefined}
        onWithdrawRefund={() => undefined}
        refundRequestsEnabled
        labels={koPaymentLabels}
        locale="ko-KR"
        formatTime={() => '2026. 1. 1. 오후 12:00'}
      />
    </div>
  )
}

export const At320: Story = {
  render: () => <Narrow width="20rem" />,
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
  },
}

export const At375: Story = {
  render: () => <Narrow width="23.4375rem" />,
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
  },
}

/** 끊을 곳이 없는 긴 영문 이름(공백 없는 토큰)이 카드 머리에서 삐져나가지 않는다 */
export const AnUnbreakableEnglishNameAt320: Story = {
  render: () => <Narrow width="20rem" name={'Supercalifragilisticexpialidocious'.repeat(3)} />,
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
    const heading = canvas.getByRole('heading', { level: 2 })
    await expect(heading.getBoundingClientRect().right).toBeLessThanOrEqual(
      frame.getBoundingClientRect().right,
    )
  },
}

export const English: Story = {
  args: { labels: undefined, locale: 'en-US' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Request a refund' })).toBeVisible()
  },
}
