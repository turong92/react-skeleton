import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, waitFor, within } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { createFakeAdmin } from '../stories/fakeAdmin'
import { WithQuery } from '../stories/WithQuery'
import { AdminCouponDefinitions } from './AdminCouponDefinitions'
import { koRewardsAdminLabels } from './labels'

/**
 * 쿠폰 운영 — 정의 목록(혜택 한 줄 · 상태 · 발급 수), 만들기(단계 편집기 + 범위 · 유효기간 · 한도), 상태 바꾸기, 계정에 주기, 공용 코드, 한 계정의 쿠폰 보기 · 회수.
 * 보관한 정의는 새로 줄 수 없다. 이미 받은 쿠폰은 그대로 쓴다.
 */
const meta = {
  title: 'Packages/rewards/admin/AdminCouponDefinitions',
  component: AdminCouponDefinitions,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeAdmin().api,
    labels: koRewardsAdminLabels,
    userLabels: koRewardsLabels,
    locale: 'ko-KR',
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminCouponDefinitions>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => <AdminCouponDefinitions {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas }) => {
    const table = within(await canvas.findByRole('table', { name: '쿠폰 정의 목록' }))
    await expect(table.getByText('무료 이용권')).toBeVisible()
    await expect(table.getByText('무료')).toBeVisible()
    await expect(table.getByText('4')).toBeVisible()
  },
}

export const CreateFromATemplate: Story = {
  render: (args) => <AdminCouponDefinitions {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '쿠폰 만들기' }))
    const dialog = within(await screen.findByRole('dialog', { name: '쿠폰 만들기' }))
    await userEvent.type(dialog.getByLabelText(/^이름/), '3달 무료')
    await userEvent.click(dialog.getByRole('button', { name: '3달 무료' }))
    await userEvent.click(dialog.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const table = within(await canvas.findByRole('table', { name: '쿠폰 정의 목록' }))
    await expect(await table.findByText('3회 무료')).toBeVisible()
  },
}

export const IssueAndMakeACode: Story = {
  render: (args) => <AdminCouponDefinitions {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '계정에 주기: 무료 이용권' }))
    const issue = within(await screen.findByRole('dialog', { name: '무료 이용권 주기' }))
    await userEvent.type(issue.getByLabelText('계정 id'), 'acc_1, acc_2, skip_3')
    await userEvent.click(issue.getByRole('button', { name: '계정에 주기' }))
    await expect(await issue.findByText('2명에게 줬고 1명은 건너뛰었어요.')).toBeVisible()
    await userEvent.click(issue.getByRole('button', { name: '닫기' }))
    await userEvent.click(canvas.getByRole('button', { name: '공용 코드 만들기: 무료 이용권' }))
    const code = within(await screen.findByRole('dialog', { name: '무료 이용권 공용 코드' }))
    await expect(await code.findByText('WELCOME')).toBeVisible()
  },
}

export const ArchivedCannotBeGiven: Story = {
  render: (args) => <AdminCouponDefinitions {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    const status = await canvas.findByLabelText('무료 이용권: 사용 중')
    await userEvent.selectOptions(status, 'ARCHIVED')
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: '계정에 주기: 무료 이용권' })).toBeDisabled(),
    )
  },
}
