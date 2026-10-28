import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { createFakeRewards } from '../stories/fakeRewards'
import { WithQuery } from '../stories/WithQuery'
import { PointBalance } from './PointBalance'

/** 포인트 잔액 한 칸(`GET /points`) — 곧 소멸할 포인트가 있으면 아래에 날짜와 함께 안내한다. */
const meta = {
  title: 'Packages/rewards/PointBalance',
  component: PointBalance,
  parameters: { layout: 'centered' },
  args: { api: createFakeRewards().api, labels: koRewardsLabels, locale: 'ko-KR' },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof PointBalance>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('1,200 P')).toBeVisible()
    await expect(canvas.getByText(/300 P 소멸 예정/)).toBeVisible()
  },
}

export const NoPoints: Story = {
  args: { api: createFakeRewards({ emptyPoints: true }).api },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('0 P')).toBeVisible()
    await expect(canvas.queryByText(/소멸 예정/)).toBeNull()
  },
}
