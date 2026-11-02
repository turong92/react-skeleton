import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { WithQuery } from '../stories/WithQuery'
import { AdminBroadcastDetail } from './AdminBroadcastDetail'
import { koBroadcastAdminLabels } from './labels.ko'
import { createFakeBroadcastAdmin } from './stories/fakeBroadcastAdmin'

/**
 * 공지 상세 - 상태 · 통계 카드(예상 대상 · 넘긴 사람 · 알림함 저장/읽음 · 푸시 넣음/성공/실패/보내지 않음/**클릭**) · 상태별 단추 · 만든 사람 · 보낸 사람 · 시각.
 * 보내는 중이면 10초마다 다시 읽는다. 취소 · 예약 풀기 · 지우기는 확인 창을 거치고, `notification-broadcast.send` 가 없으면 단추가 없다.
 * 푸시 클릭 칸은 서비스 워커가 보고한 열람(알림함 읽음과 따로 센다)이고, 클릭률은 성공 대비다.
 */
const meta = {
  title: 'Packages/notifications/admin/AdminBroadcastDetail',
  component: AdminBroadcastDetail,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeBroadcastAdmin().api,
    id: 'bc_sent',
    labels: koBroadcastAdminLabels,
    locale: 'ko-KR',
    typeLabels: { 'notice.service': '서비스 공지' },
    onEdit: fn(),
    onDeleted: fn(),
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminBroadcastDetail>
export default meta
type Story = StoryObj<typeof meta>

const stat = (canvas: ReturnType<typeof within>, label: string) =>
  canvas.getByText(label).closest('dl') as HTMLElement

export const SentWithPushClicks: Story = {
  render: (args) => <AdminBroadcastDetail {...args} api={createFakeBroadcastAdmin().api} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: '정기 점검 안내' })).toBeVisible()
    await expect(canvas.getByText('보냄')).toBeVisible()
    // 120명에게 넘김 → 푸시 성공 108, 클릭 24 = 성공 대비 22%
    const clicks = within(stat(canvas, '푸시 클릭'))
    await expect(clicks.getByText('24')).toBeVisible()
    await expect(clicks.getByText('성공 대비 22%')).toBeVisible()
    await expect(within(stat(canvas, '알림함 읽음')).getByText('저장 대비 25%')).toBeVisible()
    // 끝난 공지에는 상태를 바꾸는 단추가 없다
    await expect(canvas.queryByRole('button', { name: '보내기 취소' })).toBeNull()
  },
}

export const SendingCanBeCancelledAfterConfirming: Story = {
  render: (args) => {
    const fake = createFakeBroadcastAdmin()
    ;(globalThis as { __fakeCalls?: string[] }).__fakeCalls = fake.calls
    return <AdminBroadcastDetail {...args} id="bc_sending" api={fake.api} />
  },
  play: async ({ canvas, userEvent }) => {
    const calls = (globalThis as { __fakeCalls?: string[] }).__fakeCalls ?? []
    await expect(await canvas.findByText('보내는 중')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '보내기 취소' }))
    const dialog = within(await screen.findByRole('dialog', { name: '이 공지를 취소할까요?' }))
    await expect(calls).toEqual([])
    await userEvent.click(dialog.getByRole('button', { name: '공지 취소' }))
    await waitFor(() => expect(calls).toEqual(['cancel:bc_sending']))
    await expect(await canvas.findByText('취소됨')).toBeVisible()
  },
}

export const FailedCanResume: Story = {
  render: (args) => (
    <AdminBroadcastDetail {...args} id="bc_failed" api={createFakeBroadcastAdmin().api} />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText(/보내다가 멈췄어요 \(TimeoutException\)/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '이어 보내기' }))
    await expect(await canvas.findByText('보내는 중')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '이어 보내기' })).toBeNull()
  },
}

export const ScheduledCanBeUnscheduled: Story = {
  render: (args) => (
    <AdminBroadcastDetail {...args} id="bc_scheduled" api={createFakeBroadcastAdmin().api} />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '예약 풀기' }))
    const dialog = within(await screen.findByRole('dialog', { name: '예약을 풀까요?' }))
    await userEvent.click(dialog.getByRole('button', { name: '예약 풀기' }))
    await expect(await canvas.findByText('임시 저장')).toBeVisible()
  },
}

export const CancelledShowsWho: Story = {
  render: (args) => (
    <AdminBroadcastDetail {...args} id="bc_cancelled" api={createFakeBroadcastAdmin().api} />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('취소한 사람')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '보내기 취소' })).toBeNull()
  },
}

export const DraftCanBeEditedOrDeleted: Story = {
  render: (args) => (
    <AdminBroadcastDetail {...args} id="bc_draft" api={createFakeBroadcastAdmin().api} />
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '고치기' }))
    await expect(args.onEdit).toHaveBeenCalledWith('bc_draft')
    await userEvent.click(canvas.getByRole('button', { name: '지우기' }))
    const dialog = within(await screen.findByRole('dialog', { name: '이 임시 저장을 지울까요?' }))
    await userEvent.click(dialog.getByRole('button', { name: '지우기' }))
    await waitFor(() => expect(args.onDeleted).toHaveBeenCalled())
  },
}

export const NoButtonsWithoutPermission: Story = {
  render: (args) => (
    <AdminBroadcastDetail
      {...args}
      id="bc_sending"
      api={createFakeBroadcastAdmin().api}
      can={() => false}
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('보내는 중')).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}
