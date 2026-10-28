import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { createFakeRewards } from '../stories/fakeRewards'
import { WithQuery } from '../stories/WithQuery'
import { PointHistory } from './PointHistory'

/** 포인트 내역(`GET /points/history`, 커서) — 최신순, 「더 보기」 로 이어 받는다. 적립은 +, 사용 · 소멸은 −. */
const meta = {
  title: 'Packages/rewards/PointHistory',
  component: PointHistory,
  parameters: { layout: 'padded' },
  args: { api: createFakeRewards().api, labels: koRewardsLabels, locale: 'ko-KR' },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof PointHistory>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => <PointHistory {...args} api={createFakeRewards().api} />,
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('+100 P')).toBeVisible()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4)
    await userEvent.click(canvas.getByRole('button', { name: '더 보기' }))
    await expect(await canvas.findAllByRole('listitem')).toHaveLength(7)
    await expect(canvas.queryByRole('button', { name: '더 보기' })).toBeNull()
  },
}

export const Empty: Story = {
  render: (args) => <PointHistory {...args} api={createFakeRewards({ emptyPoints: true }).api} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('아직 포인트 내역이 없어요.')).toBeVisible()
  },
}
