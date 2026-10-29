import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, waitFor, within } from 'storybook/test'
import { createFakeAdmin } from '../stories/fakeAdmin'
import { WithQuery } from '../stories/WithQuery'
import { AdminCampaigns } from './AdminCampaigns'
import { koRewardsAdminLabels } from './labels'

/**
 * 이벤트 운영 — 목록, 줄마다 켜고 끄는 스위치, 「고치기」, 「이벤트 만들기」(종류별 설정 + 보상 목록).
 * `can('campaign.manage')` 가 거짓이면 스위치가 잠기고 단추가 없다(서버도 403). 모듈의 `admin.enabled` 가 꺼진 서버(404)는 안내만.
 */
const meta = {
  title: 'Packages/rewards/admin/AdminCampaigns',
  component: AdminCampaigns,
  parameters: { layout: 'padded' },
  args: { api: createFakeAdmin().api, labels: koRewardsAdminLabels, locale: 'ko-KR' },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminCampaigns>
export default meta
type Story = StoryObj<typeof meta>

export const SwitchAnEventOff: Story = {
  render: (args) => <AdminCampaigns {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    const table = within(await canvas.findByRole('table', { name: '이벤트 목록' }))
    const sw = table.getByRole('switch', { name: '10월 출석 이벤트 켜기' })
    await expect(sw).toBeChecked()
    await expect(table.getByRole('switch', { name: '친구 초대 켜기' })).not.toBeChecked()
    await userEvent.click(sw)
    await waitFor(() =>
      expect(table.getByRole('switch', { name: '10월 출석 이벤트 켜기' })).not.toBeChecked(),
    )
  },
}

export const ReadOnlyWithoutPermission: Story = {
  render: (args) => <AdminCampaigns {...args} api={createFakeAdmin().api} can={() => false} />,
  play: async ({ canvas }) => {
    const table = within(await canvas.findByRole('table'))
    await expect(table.getByRole('switch', { name: '친구 초대 켜기' })).toBeDisabled()
    await expect(canvas.queryByRole('button', { name: '이벤트 만들기' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: /고치기/ })).toBeNull()
  },
}

export const CreateAnAttendanceEvent: Story = {
  render: (args) => <AdminCampaigns {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '이벤트 만들기' }))
    const dialog = within(await screen.findByRole('dialog', { name: '이벤트 만들기' }))
    await userEvent.type(dialog.getByLabelText(/^이름/), '11월 출석')
    await userEvent.click(dialog.getByRole('button', { name: '보상 더하기' }))
    await userEvent.type(dialog.getByLabelText('매일 받는 보상 1 포인트'), '10')
    await userEvent.click(dialog.getByRole('button', { name: '달성 보상 더하기' }))
    await userEvent.click(dialog.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(await canvas.findByText('11월 출석')).toBeVisible()
  },
}

export const ReferralHasItsOwnSettings: Story = {
  render: (args) => <AdminCampaigns {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '고치기: 친구 초대' }))
    const dialog = within(await screen.findByRole('dialog', { name: '친구 초대 고치기' }))
    await expect(dialog.getByLabelText('종류')).toBeDisabled()
    await expect(dialog.getByLabelText('초대한 사람 보상 시점')).toHaveValue('SIGNAL')
    await expect(dialog.getByLabelText('새 계정 인정 기간(가입 후 일수)')).toHaveValue(7)
    await expect(dialog.getByLabelText('초대받은 사람의 보상 1 쿠폰')).toHaveValue('d1')
  },
}

export const CreateAnAchievementEvent: Story = {
  render: (args) => (
    <AdminCampaigns
      {...args}
      api={createFakeAdmin().api}
      badgeChoices={[{ code: 'writer-10', name: '열 번째 노트' }]}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '이벤트 만들기' }))
    const dialog = within(await screen.findByRole('dialog', { name: '이벤트 만들기' }))
    await userEvent.type(dialog.getByLabelText(/^이름/), '노트 업적')
    await userEvent.selectOptions(dialog.getByLabelText('종류'), '업적')
    await userEvent.type(dialog.getByLabelText(/^수치 이름/), 'notes.created')
    await userEvent.clear(dialog.getByLabelText('달성 단계 1 기준값'))
    await userEvent.type(dialog.getByLabelText('달성 단계 1 기준값'), '10')
    await userEvent.click(dialog.getByRole('button', { name: '보상 더하기' }))
    await userEvent.selectOptions(dialog.getByLabelText('달성 단계 1 1 보상 종류'), '배지')
    await userEvent.selectOptions(dialog.getByLabelText('달성 단계 1 1 배지'), '열 번째 노트')
    await userEvent.click(dialog.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(await canvas.findByText('노트 업적')).toBeVisible()
  },
}
