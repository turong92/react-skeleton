import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { createFakeRewards } from '../stories/fakeRewards'
import { WithQuery } from '../stories/WithQuery'
import { InviteCard } from './InviteCard'

/**
 * 친구 초대 카드 — 내 초대 코드와 복사 단추, 초대 · 보상 수(`GET /referrals/me`).
 * `shareText` 를 주면 복사되는 글자가 코드 대신 초대 링크다. 링크로 들어온 사람은 `useReferralCapture` 가 `?ref=` 를 보관했다가 로그인한 뒤 한 번 claim 한다.
 */
const meta = {
  title: 'Packages/rewards/InviteCard',
  component: InviteCard,
  parameters: { layout: 'centered' },
  args: { api: createFakeRewards().api, labels: koRewardsLabels },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof InviteCard>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('AB12CD34')).toBeVisible()
    await expect(canvas.getByText('초대 3명')).toBeVisible()
    await expect(canvas.getByText('보상 2명')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '코드 복사' })).toBeVisible()
  },
}
