import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import { createFakeAdmin } from '../stories/fakeAdmin'
import { WithQuery } from '../stories/WithQuery'
import { AdminRewardGrants } from './AdminRewardGrants'
import { koRewardsAdminLabels } from './labels'

/** 지급 건 운영 — 처음엔 「지급 못 함」만. 못 준 건은 「다시 지급」(성공하면 대기로 옮겨 이 목록에서 빠진다), 대기 건은 「멈추기」. */
const meta = {
  title: 'Packages/rewards/admin/AdminRewardGrants',
  component: AdminRewardGrants,
  parameters: { layout: 'padded' },
  args: { api: createFakeAdmin().api, labels: koRewardsAdminLabels, locale: 'ko-KR' },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminRewardGrants>
export default meta
type Story = StoryObj<typeof meta>

export const RetryAFailedGrant: Story = {
  render: (args) => <AdminRewardGrants {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    const table = within(await canvas.findByRole('table', { name: '보상 지급 건 목록' }))
    await expect(table.getByText('100 포인트')).toBeVisible()
    await expect(table.getByText('job dead')).toBeVisible()
    await userEvent.click(table.getByRole('button', { name: '다시 지급: 100 포인트' }))
    await waitFor(() => expect(canvas.queryByText('100 포인트')).toBeNull())
    await expect(await canvas.findByText('이 조건의 지급 건이 없어요.')).toBeVisible()
  },
}

export const CancelAWaitingGrant: Story = {
  render: (args) => <AdminRewardGrants {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(await canvas.findByLabelText('상태'), 'PENDING')
    await userEvent.click(await canvas.findByRole('button', { name: '멈추기: 무료 이용권' }))
    await waitFor(() => expect(canvas.queryByText('무료 이용권')).toBeNull())
  },
}

export const NoButtonsWithoutPermission: Story = {
  render: (args) => <AdminRewardGrants {...args} api={createFakeAdmin().api} can={() => false} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('100 포인트')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /다시 지급/ })).toBeNull()
  },
}
