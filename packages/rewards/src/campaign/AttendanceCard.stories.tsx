import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { createFakeRewards } from '../stories/fakeRewards'
import { WithQuery } from '../stories/WithQuery'
import { AttendanceCard } from './AttendanceCard'

/**
 * 출석 카드 — `api` 는 `createRewardsApi` 의 결과(`GET /campaigns` · `POST /campaigns/{id}/attendance`), TanStack Query 아래에서 쓴다.
 * 「출석하기」 를 누르면 「오늘 출석함」 으로 잠기고 방금 받은 보상이 뜬다. 끝난 이벤트(409)는 안내만. `monthDays` 를 주면 이번 달 출석한 날 줄이 생긴다.
 */
const meta = {
  title: 'Packages/rewards/AttendanceCard',
  component: AttendanceCard,
  parameters: { layout: 'centered' },
  args: { api: createFakeRewards().api, campaignId: 'att', labels: koRewardsLabels },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AttendanceCard>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => <AttendanceCard {...args} api={createFakeRewards().api} />,
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('총 6일 출석')).toBeVisible()
    await expect(canvas.getByText('7일 연속 출석하면 보상이 있어요')).toBeVisible()
    await userEvent.click(await canvas.findByRole('button', { name: '출석하기' }))
    const done = await canvas.findByRole('button', { name: '오늘 출석함' })
    await expect(done).toBeDisabled()
    await waitFor(() => expect(canvas.getByText('총 7일 출석')).toBeVisible())
    await expect(canvas.getByText('100 포인트')).toBeVisible()
  },
}

export const AlreadyChecked: Story = {
  render: (args) => (
    <AttendanceCard {...args} api={createFakeRewards({ checkedToday: true }).api} />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: '오늘 출석함' })).toBeDisabled()
  },
}

export const Ended: Story = {
  render: (args) => <AttendanceCard {...args} api={createFakeRewards({ ended: true }).api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '출석하기' }))
    await expect(await canvas.findByText('끝났거나 열려 있지 않은 이벤트예요.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '출석하기' })).toBeDisabled()
  },
}

export const WithMonthDays: Story = {
  args: { monthDays: ['2026-10-26', '2026-10-27', '2026-10-28'] },
  render: (args) => <AttendanceCard {...args} api={createFakeRewards().api} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('이번 달 3일 출석')).toBeVisible()
    await expect(canvas.getAllByRole('listitem').length).toBeGreaterThanOrEqual(5)
  },
}
