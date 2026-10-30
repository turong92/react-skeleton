import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { createFakeRewards } from '../stories/fakeRewards'
import { WithQuery } from '../stories/WithQuery'
import { InviteList } from './InviteList'

/**
 * 초대 현황 — 내가 초대한 사람들(`GET /referrals/me/invitees`, 커서)을 새것부터: 가린 이름 · 상태 배지 · 날짜.
 * 상태는 넷 — 기다리는 중(가입만 함) · 확인 중(보상 예정일이 있으면 같이) · 보상 지급 · 보상 없음. 이름이 없으면(null) 「친구 n」.
 * 「더 보기」 로 이어 받는다. `InviteCard`(내 코드) 옆에 둔다.
 */
const meta = {
  title: 'Packages/rewards/InviteList',
  component: InviteList,
  parameters: { layout: 'padded' },
  args: { api: createFakeRewards().api, labels: koRewardsLabels, locale: 'ko-KR' },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof InviteList>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => <InviteList {...args} api={createFakeRewards().api} />,
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('김수***')).toBeVisible()
    await expect(canvas.getByText('보상 지급')).toBeVisible()
    await expect(canvas.getByText('친구 2')).toBeVisible()
    await expect(canvas.getByText('확인 중')).toBeVisible()
    // 보상 예정일은 확인 중인 줄에만, 받은 줄에는 받은 때 - 「보상 예정」 이 한 번만 나온다
    await expect(canvas.getAllByText(/보상 예정/)).toHaveLength(1)
    await expect(canvas.getByText(/· .*지급$/)).toBeVisible()
    await expect(canvas.getByText('lee***')).toBeVisible()
    await expect(canvas.getByText('가입함')).toBeVisible()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3)
    await userEvent.click(canvas.getByRole('button', { name: '더 보기' }))
    await expect(await canvas.findByText('보상 없음')).toBeVisible()
    await expect(canvas.getByText('pa***')).toBeVisible()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(5)
    await expect(canvas.queryByRole('button', { name: '더 보기' })).toBeNull()
  },
}

export const Empty: Story = {
  render: (args) => <InviteList {...args} api={createFakeRewards({ emptyInvitees: true }).api} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('아직 초대한 친구가 없어요.')).toBeVisible()
  },
}
