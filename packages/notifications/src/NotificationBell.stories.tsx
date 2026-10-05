import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactNode } from 'react'
import { expect, screen, waitFor, within } from 'storybook/test'
import { NotificationBell } from './NotificationBell'
import type { NotificationsApi } from './notificationsApi'
import { createFakeInbox } from './stories/fakeInbox'

/**
 * 종 버튼 + 안 읽은 수 배지 + 누르면 받은편지함 대화상자. 데이터는 `api`(`createNotificationsApi` 의 결과)로 주입한다 —
 * 여기서는 메모리 안의 가짜 받은편지함(`stories/fakeInbox.ts`)이다. TanStack Query 의 `QueryClientProvider` 아래에서 쓴다.
 */
function WithQuery({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function Demo({ api }: { api: NotificationsApi }) {
  return (
    <WithQuery>
      <NotificationBell api={api} />
    </WithQuery>
  )
}

const meta = {
  title: 'Packages/notifications/NotificationBell',
  component: NotificationBell,
  parameters: { layout: 'centered' },
  args: { api: createFakeInbox().api },
} satisfies Meta<typeof NotificationBell>
export default meta
type Story = StoryObj<typeof meta>

export const WithUnread: Story = {
  render: () => <Demo api={createFakeInbox().api} />,
  play: async ({ canvas, userEvent }) => {
    const bell = await canvas.findByRole('button', { name: 'Notifications, 2 unread' })
    await userEvent.click(bell)
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' })
    await expect(await within(dialog).findByText('새 댓글이 달렸습니다')).toBeInTheDocument()
    await expect(within(dialog).getAllByRole('listitem')).toHaveLength(3)
  },
}

export const MarkOneAsRead: Story = {
  render: () => <Demo api={createFakeInbox().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Notifications, 2 unread' }))
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' })
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Mark as read: 환영합니다' }),
    )
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument(),
    )
  },
}

export const MarkAllAsRead: Story = {
  render: () => <Demo api={createFakeInbox().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Notifications, 2 unread' }))
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' })
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Mark all as read' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Notifications' })).toBeInTheDocument(),
    )
    await expect(within(dialog).getByRole('button', { name: 'Mark all as read' })).toBeDisabled()
  },
}

export const Empty: Story = {
  render: () => <Demo api={createFakeInbox({ empty: true }).api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Notifications' }))
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' })
    await expect(await within(dialog).findByText('No notifications')).toBeInTheDocument()
  },
}

/** 목록을 기다리는 동안은 스피너 */
export const Loading: Story = {
  render: () => {
    const never = new Promise<never>(() => undefined)
    const api: NotificationsApi = {
      ...createFakeInbox().api,
      list: () => never,
    }
    return <Demo api={api} />
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Notifications/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' })
    await expect(within(dialog).getByRole('status')).toHaveTextContent('Loading')
  },
}

export const KeyboardOpensAndEscapeReturnsFocus: Story = {
  render: () => <Demo api={createFakeInbox().api} />,
  play: async ({ canvas, userEvent }) => {
    const bell = await canvas.findByRole('button', { name: 'Notifications, 2 unread' })
    await userEvent.tab()
    await expect(bell).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    const dialog = (await screen.findByRole('dialog', {
      name: 'Notifications',
    })) as HTMLDialogElement
    // Esc 는 브라우저가 하는 일 — 같은 경로(cancel → close)로 대신한다(UI/Dialog 스토리 참고)
    dialog.requestClose()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(bell).toHaveFocus()
  },
}
