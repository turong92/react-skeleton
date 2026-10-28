import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { koPaymentLabels } from './labels'
import type { OrderStatus } from './ledgerTypes'
import { OrderStatusBadge, SettlementBadge } from './OrderStatusBadge'

/**
 * 결제 상태 알약 — **눌리지 않는다**(단추도 링크도 아니고 포커스도 안 간다). 뜻은 글자로, 색은 거들 뿐.
 * 열린 환불이 있으면 상태 대신: 요청만 했으면(`openRefundStatus: 'REQUESTED'`) 「환불 요청함」, 진행 중이면(`'PENDING'`) 「환불 중」.
 * 낱말은 한 벌: 결제됨 · 결제 안 됨 · 시간이 지났어요 · 그만뒀어요 · 환불됨 … 이 패키지가 모르는 상태는 코드를 그리지 않고 「확인 필요」.
 */
const STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMING',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
  'EXPIRED',
  'CANCELED',
]

const meta = {
  title: 'Packages/payment/OrderStatusBadge',
  component: OrderStatusBadge,
  args: { status: 'PAID', labels: koPaymentLabels },
} satisfies Meta<typeof OrderStatusBadge>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('결제됨')).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
    await expect(canvas.queryByRole('link')).toBeNull()
  },
}

export const EveryStatus: Story = {
  render: (args) => (
    <ul
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-sm)',
        listStyle: 'none',
        padding: 0,
      }}
    >
      {STATUSES.map((status) => (
        <li key={status}>
          <OrderStatusBadge {...args} status={status} />
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvas }) => {
    for (const status of STATUSES)
      await expect(canvas.getByText(koPaymentLabels.orderStatus[status])).toBeVisible()
  },
}

export const RefundOnlyRequested: Story = {
  args: { openRefundStatus: 'REQUESTED' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('환불 요청함')).toBeVisible()
    await expect(canvas.queryByText('환불 중')).toBeNull()
    await expect(canvas.queryByText('결제됨')).toBeNull()
  },
}

export const RefundInProgress: Story = {
  args: { openRefundStatus: 'PENDING' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('환불 중')).toBeVisible()
    await expect(canvas.queryByText('결제됨')).toBeNull()
  },
}

export const UnknownStatusIsNeutral: Story = {
  args: { status: 'SOMETHING_NEW' as never },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('확인 필요')).toBeVisible()
    await expect(canvas.queryByText('SOMETHING_NEW')).toBeNull()
  },
}

export const English: Story = {
  args: { labels: undefined, status: 'CANCELED' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Stopped')).toBeVisible()
  },
}

/** 정산 알약 — 쿠폰으로 0원은 「무료(쿠폰)」, 결제 면제 계정은 「결제 면제」. 결제사가 받은 보통 결제에는 아무것도 없다. 눌리지 않는다 */
export const Settlements: Story = {
  render: (args) => (
    <p>
      <SettlementBadge settlement="FREE" labels={args.labels} />
      <SettlementBadge settlement="EXEMPT" labels={args.labels} />
      <SettlementBadge settlement="PROVIDER" labels={args.labels} />
    </p>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('무료(쿠폰)')).toBeVisible()
    await expect(canvas.getByText('결제 면제')).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}
