import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { koPaymentLabels } from '../labels'
import { adminRefund } from '../test/fixtures'
import { RefundRequestTable } from './RefundRequestTable'

/**
 * 환불 요청 목록 — 줄마다 결제 번호 · 금액 · 사유(말로) · 요청한 때 · 상태 알약. 결정을 기다리는 줄에는 채운 「요청대로 환불하기」 하나와
 * 테두리 단추 「요청 거절하기」 · 「결제 보기」. 단추 이름에 금액(결제 번호)이 붙어 줄마다 구별된다. 보이기만 한다 — 돈이 나가는 「요청대로 환불하기」는
 * 부모가 확인 창(`AdminRefundDialog`)을 거쳐 부른다.
 */
const refunds = [
  adminRefund({ id: 'rfd_1', orderId: 'ord_1', amount: { amount: 3000, currency: 'KRW' } }),
  adminRefund({
    id: 'rfd_2',
    orderId: 'ord_2',
    amount: { amount: 1000, currency: 'KRW' },
    reasonCode: 'NOT_DELIVERED',
  }),
]

const meta = {
  title: 'Packages/payment/admin/RefundRequestTable',
  component: RefundRequestTable,
  args: {
    refunds,
    onApprove: fn(),
    onReject: fn(),
    onOpenOrder: fn(),
    labels: koPaymentLabels,
    locale: 'ko-KR',
    formatTime: () => '2026. 1. 1. 오후 12:00',
  },
} satisfies Meta<typeof RefundRequestTable>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: '환불 요청 목록' })
    const rows = within(table).getAllByRole('row').slice(1)
    await expect(rows).toHaveLength(2)
    await expect(within(rows[0]).getByText('ord_1')).toBeVisible()
    await expect(within(rows[0]).getByText('3,000원')).toBeVisible()
    await expect(within(rows[0]).getByText('마음이 바뀌었어요')).toBeVisible()
    await expect(within(rows[1]).getByText('받지 못했어요')).toBeVisible()
    await expect(within(rows[0]).getByText('환불 요청함')).toBeVisible()
  },
}

export const EachRowHasItsOwnNamedActions: Story = {
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const approve = canvas.getByRole('button', { name: '요청대로 환불하기: 1,000원 (결제 ord_2)' })
    // 줄마다 채운 단추를 두면 스무 줄에 스무 개 - 줄의 결정은 테두리 단추, 채운 단추는 화면에 하나(확인 창의 확인)뿐
    await expect(approve).toHaveAttribute('data-variant', 'secondary')
    await expect(canvasElement.querySelectorAll('[data-variant="primary"]')).toHaveLength(0)
    await expect(canvas.getAllByRole('button', { name: /^요청대로 환불하기/ })).toHaveLength(2)
    await userEvent.click(approve)
    await expect(args.onApprove).toHaveBeenCalledWith(refunds[1])
    await userEvent.click(
      canvas.getByRole('button', { name: '요청 거절하기: 3,000원 (결제 ord_1)' }),
    )
    await expect(args.onReject).toHaveBeenCalledWith(refunds[0])
    await userEvent.click(canvas.getByRole('button', { name: '결제 보기: ord_2' }))
    await expect(args.onOpenOrder).toHaveBeenCalledWith(refunds[1])
  },
}

/** 글자만 있는 단추가 없다 — 쉬는 상태에서도 테두리나 채움이 있고, 알약과 줄은 눌리지 않는다 */
export const EveryButtonLooksPressable: Story = {
  play: async ({ canvas }) => {
    const buttons = canvas.getAllByRole('button')
    await expect(buttons).toHaveLength(6)
    for (const button of buttons) {
      const style = getComputedStyle(button)
      const boxed = style.borderTopWidth !== '0px' || style.backgroundColor !== 'rgba(0, 0, 0, 0)'
      await expect(boxed).toBe(true)
    }
    await expect(getComputedStyle(canvas.getAllByText('환불 요청함')[0]).cursor).not.toBe('pointer')
  },
}

/** 이미 끝난 줄에는 결정 단추가 없다 — 상태만 */
export const FinishedRowsHaveNoDecision: Story = {
  args: { refunds: [adminRefund({ id: 'rfd_9', status: 'SUCCEEDED' })] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('환불됨')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /요청대로 환불하기/ })).toBeNull()
    await expect(canvas.queryByRole('button', { name: /요청 거절하기/ })).toBeNull()
  },
}

export const LinkAction: Story = {
  args: {
    onOpenOrder: undefined,
    renderAction: (refund, label, name, className) => (
      <a className={className} href={`#/admin/payments/${refund.orderId}`} aria-label={name}>
        {label}
      </a>
    ),
  },
  play: async ({ canvas }) => {
    const links = canvas.getAllByRole('link', { name: /^결제 보기: / })
    await expect(links).toHaveLength(2)
    for (const link of links) {
      const style = getComputedStyle(link)
      await expect(style.borderTopWidth).toBe('1px')
      await expect(style.textDecorationLine).toBe('none')
      await expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(36)
    }
  },
}

/** 375px 폭 — 글자가 한 글자씩 세로로 쪼개지지 않고, 표는 자기 안에서 가로로 스크롤되어 단추에 닿는다(페이지는 넘치지 않는다) */
export const StaysUsableAt375px: Story = {
  args: {
    refunds: [adminRefund({ id: 'rfd_long', orderId: 'ord_b4c8e05f0a1da64cb96790a039db421e' })],
  },
  render: (args) => (
    <div style={{ width: '375px' }}>
      <RefundRequestTable {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const region = canvas.getByRole('region', { name: '환불 요청 목록' })
    const row = within(region).getAllByRole('row')[1]
    // 한 글자씩 쪼개지면 줄이 수백 px 로 길어진다
    await expect(row.getBoundingClientRect().height).toBeLessThan(200)
    await expect(region.scrollWidth).toBeGreaterThan(region.clientWidth)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    const approve = within(row).getByRole('button', { name: /^요청대로 환불하기/ })
    approve.scrollIntoView({ inline: 'center' })
    const box = approve.getBoundingClientRect()
    const edge = region.getBoundingClientRect()
    await expect(box.left).toBeGreaterThanOrEqual(edge.left)
    await expect(box.right).toBeLessThanOrEqual(edge.right)
  },
}

export const Empty: Story = {
  args: { refunds: [] },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('heading', { name: '결정을 기다리는 환불 요청이 없어요' }),
    ).toBeVisible()
  },
}

export const Loading: Story = {
  args: { refunds: [], loading: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('불러오는 중')
  },
}

export const ErrorKeepsTheRows: Story = {
  args: { error: true, onRetry: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await expect(within(canvas.getByRole('table')).getAllByRole('row')).toHaveLength(3)
    await userEvent.click(canvas.getByRole('button', { name: '다시 불러오기' }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}

export const English: Story = {
  args: { labels: undefined, locale: 'en-US' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table', { name: 'Refund requests' })).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'Refund as requested: ₩3,000 (payment ord_1)' }),
    ).toBeVisible()
    await expect(canvas.getAllByText('I changed my mind')).toHaveLength(1)
  },
}
