import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor } from 'storybook/test'
import { NotificationPreferences } from './NotificationPreferences'
import { createFakeInbox } from './stories/fakeInbox'

/**
 * 알림 종류별 수신 설정 — 서버가 알려 준 종류마다 스위치 한 줄(켜짐 = 받는다), 누르면 바로 저장한다.
 * 문구는 `labels` 로 번역해 넘긴다(없으면 종류 이름 그대로). 설정 화면의 한 카드 안에 넣는다.
 */
function Demo({ api, ...props }: Parameters<typeof NotificationPreferences>[0]) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={client}>
      <NotificationPreferences api={api} {...props} />
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Packages/notifications/NotificationPreferences',
  component: NotificationPreferences,
  args: { api: createFakeInbox().api },
  render: (args) => <Demo {...args} api={createFakeInbox().api} />,
} satisfies Meta<typeof NotificationPreferences>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { labels: { NOTE_UPDATED: 'Note edits', 'comment.created': 'Comments' } },
  play: async ({ canvas, userEvent }) => {
    const note = await canvas.findByRole('switch', { name: 'Note edits' })
    await expect(note).toBeChecked()
    // 이름 없는 종류는 종류 이름 그대로, 꺼진 종류는 꺼짐
    await expect(canvas.getByRole('switch', { name: 'reward.granted' })).not.toBeChecked()
    await userEvent.click(note)
    await waitFor(() =>
      expect(canvas.getByRole('switch', { name: 'Note edits' })).not.toBeChecked(),
    )
    await userEvent.click(canvas.getByRole('switch', { name: 'reward.granted' }))
    await waitFor(() =>
      expect(canvas.getByRole('switch', { name: 'reward.granted' })).toBeChecked(),
    )
  },
}

export const Loading: Story = {
  render: (args) => (
    <Demo
      {...args}
      api={{ ...createFakeInbox().api, preferences: () => new Promise<never>(() => undefined) }}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading')
  },
}

export const NothingToConfigure: Story = {
  render: (args) => (
    <Demo {...args} api={{ ...createFakeInbox().api, preferences: async () => ({ items: [] }) }} />
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'No notification types to configure' }),
    ).toBeVisible()
  },
}

/** 불러오기에 실패하면 빈 상태가 아니라 오류 문장 + 다시 시도 단추 */
export const LoadFailedThenRetry: Story = {
  render: (args) => {
    const inbox = createFakeInbox().api
    let failures = 1
    return (
      <Demo
        {...args}
        api={{
          ...inbox,
          preferences: async () => {
            if (failures-- > 0) throw new Error('boom')
            return inbox.preferences()
          },
        }}
        errorMessage="Could not load your notification settings."
        retryLabel="Try again"
      />
    )
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Could not load your notification settings.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(await canvas.findByRole('switch', { name: 'NOTE_UPDATED' })).toBeChecked()
  },
}
