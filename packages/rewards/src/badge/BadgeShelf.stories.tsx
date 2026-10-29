import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { createFakeBadges } from '../stories/fakeRewards'
import { WithQuery } from '../stories/WithQuery'
import { BadgeShelf } from './BadgeShelf'

/**
 * 내 배지 선반(`GET /badges/me`) - 받은 것은 격자 + 「프로필에 보이기」 스위치, 아직인 것은 흐리게.
 * 숨은 업적은 받기 전까지 이름 · 설명 · 그림 없이 「?」 만 보인다. 그림 주소가 없으면 이름 첫 글자 원.
 */
const meta = {
  title: 'Packages/rewards/BadgeShelf',
  component: BadgeShelf,
  parameters: { layout: 'padded' },
  args: { api: createFakeBadges().api, labels: koRewardsLabels, locale: 'ko-KR' },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof BadgeShelf>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('얼리 버드')).toBeVisible()
    await expect(canvas.getByText('백 번째 노트')).toBeVisible()
  },
}

export const HiddenBadge: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('숨은 배지')).toBeVisible()
    await expect(canvas.getByText('?')).toBeVisible()
  },
}

export const Empty: Story = {
  args: { api: createFakeBadges({ empty: true }).api },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('준비된 배지가 아직 없어요.')).toBeVisible()
  },
}

export const NoneEarned: Story = {
  args: { api: createFakeBadges({ noneEarned: true }).api },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('아직 받은 배지가 없어요.')).toBeVisible()
    await expect(canvas.getByText('백 번째 노트')).toBeVisible()
  },
}

export const ProfileSwitch: Story = {
  render: (args) => <BadgeShelf {...args} api={createFakeBadges().api} />,
  play: async ({ canvas, userEvent }) => {
    const switches = await canvas.findAllByRole('switch', { name: /프로필에 보이기$/ })
    await expect(switches[0]).toBeChecked()
    await expect(switches[1]).not.toBeChecked()
    await userEvent.click(switches[0])
    await waitFor(async () =>
      expect(
        (await canvas.findAllByRole('switch', { name: /프로필에 보이기$/ }))[0],
      ).not.toBeChecked(),
    )
  },
}
