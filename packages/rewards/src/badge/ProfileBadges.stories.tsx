import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { createFakeBadges } from '../stories/fakeRewards'
import { WithQuery } from '../stories/WithQuery'
import { ProfileBadges } from './ProfileBadges'

/**
 * 계정의 공개 배지 한 줄(`GET /badges/accounts/{id}`) - 로그인 없이 그린다. 이름 · 설명 · 그림만 안다.
 * 배지가 없으면 아무것도 그리지 않는다. 필명 프로필 화면에는 붙이지 않는다(계정 id 가 드러난다).
 */
const meta = {
  title: 'Packages/rewards/ProfileBadges',
  component: ProfileBadges,
  parameters: { layout: 'centered' },
  args: { api: createFakeBadges().api, accountId: 'acc-1', labels: koRewardsLabels },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof ProfileBadges>
export default meta
type Story = StoryObj<typeof meta>

export const Several: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('얼리 버드')).toBeVisible()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2)
  },
}

export const None: Story = {
  args: { api: createFakeBadges({ profile: [] }).api },
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 100))
    await expect(canvasElement.querySelector('ul')).toBeNull()
  },
}
