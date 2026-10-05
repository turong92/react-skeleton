import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { NotificationList } from './NotificationList'
import type { NotificationItem } from './types'

/** 받은편지함 목록 — 보이기만 한다(데이터 · 호출은 모른다). 안 읽은 줄은 `data-unread="true"`, `onRead` 를 주면 읽음 버튼이 생긴다. */
const base: NotificationItem = {
  id: 'n1',
  eventId: 'e1',
  recipientId: 'me',
  topic: 'billing',
  type: 'billing.paid',
  severity: 'SUCCESS',
  title: 'Payment received',
  message: 'We received your payment of $12.00',
  payload: {},
  createdAt: '2026-01-01T12:00:00Z',
  readAt: null,
}
const items: NotificationItem[] = [
  base,
  {
    ...base,
    id: 'n2',
    eventId: 'e2',
    severity: 'WARNING',
    title: 'Card expires soon',
    message: null,
    readAt: '2026-01-01T13:00:00Z',
  },
  {
    ...base,
    id: 'n3',
    eventId: 'e3',
    severity: 'ERROR',
    title: 'Payment failed',
    message: 'Your card was declined',
  },
]

const meta = {
  title: 'Packages/notifications/NotificationList',
  component: NotificationList,
  args: { items, onRead: fn() },
} satisfies Meta<typeof NotificationList>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const rows = canvas.getAllByRole('listitem')
    await expect(rows).toHaveLength(3)
    await expect(rows[0]).toHaveAttribute('data-unread', 'true')
    await expect(rows[1]).not.toHaveAttribute('data-unread')
    // 읽은 줄에는 읽음 버튼이 없다
    await expect(canvas.getAllByRole('button')).toHaveLength(2)
    await userEvent.click(canvas.getByRole('button', { name: 'Mark as read: Payment received' }))
    await expect(args.onRead).toHaveBeenCalledWith(items[0])
  },
}

export const ReadOnlyWithoutHandler: Story = {
  args: { onRead: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}

export const SeverityAnnounced: Story = {
  args: { severityLabels: { SUCCESS: 'Success', WARNING: 'Warning', ERROR: 'Error' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Payment failed').closest('strong')).toHaveTextContent(
      'Error: Payment failed',
    )
  },
}

export const Empty: Story = {
  args: { items: [], emptyDescription: 'You are all caught up.' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'No notifications' })).toBeVisible()
    await expect(canvas.getByText('You are all caught up.')).toBeVisible()
  },
}

export const LongText: Story = {
  args: {
    items: [
      {
        ...base,
        title: 'A very long notification title that just keeps going and going',
        message: 'And a longer message. '.repeat(15),
      },
    ],
  },
  render: (args) => (
    <div style={{ maxWidth: '20rem' }}>
      <NotificationList {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await expect(canvas.getByRole('listitem')).toBeVisible()
  },
}
