import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, waitFor, within } from 'storybook/test'
import { createFakeAdmin } from '../stories/fakeAdmin'
import { WithQuery } from '../stories/WithQuery'
import { AdminReferrals } from './AdminReferrals'
import { koRewardsAdminLabels } from './labels'

/**
 * 초대 내역 운영 — 상태 · 표시로 걸러 보는 표(「더 보기」), 「같은 네트워크」 배지, 줄 메뉴의 「승인」(확인 필요 · 보류 중만) · 「초대 취소」(사유 필수).
 * 이름은 서버가 `account.read` 가 있는 운영자에게만 준다 - 없으면 계정 id 를 보인다.
 * `can('campaign.manage')` 가 거짓이면 줄 메뉴가 없다(서버도 403).
 */
const meta = {
  title: 'Packages/rewards/admin/AdminReferrals',
  component: AdminReferrals,
  parameters: { layout: 'padded' },
  args: { api: createFakeAdmin().api, labels: koRewardsAdminLabels, locale: 'ko-KR' },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminReferrals>
export default meta
type Story = StoryObj<typeof meta>

export const ListWithFlagsAndMore: Story = {
  render: (args) => <AdminReferrals {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    const table = await canvas.findByRole('table', { name: '초대 내역' })
    await expect(within(table).getAllByRole('row')).toHaveLength(4)
    await expect(within(table).getByText('bob@example.com')).toBeVisible()
    await expect(within(table).getByText('같은 네트워크')).toBeVisible()
    // 이름이 없으면(account.read 없음) 계정 id
    await expect(within(table).getByText('acc_9')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '더 보기' }))
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(5))
  },
}

export const FilterByStatus: Story = {
  render: (args) => <AdminReferrals {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    const table = await canvas.findByRole('table', { name: '초대 내역' })
    await userEvent.selectOptions(canvas.getByLabelText('상태'), 'REVIEW')
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2))
    await userEvent.selectOptions(canvas.getByLabelText('상태'), '')
    await userEvent.selectOptions(canvas.getByLabelText('표시'), 'SAME_NETWORK')
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2))
  },
}

export const ApproveAReview: Story = {
  render: (args) => <AdminReferrals {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'bob@example.com 더보기' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '승인' }))
    await waitFor(() =>
      expect(within(canvas.getByRole('table')).getAllByText('지급됨')).toHaveLength(2),
    )
    // 승인 뒤에는 끝 상태 - 줄 메뉴가 없다
    await expect(canvas.queryByRole('button', { name: 'bob@example.com 더보기' })).toBeNull()
  },
}

export const CancelNeedsAReason: Story = {
  render: (args) => <AdminReferrals {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'bob@example.com 더보기' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '초대 취소' }))
    const dialog = within(await screen.findByRole('dialog', { name: '초대 취소' }))
    await expect(dialog.getByRole('button', { name: '초대 취소' })).toBeDisabled()
    await userEvent.type(dialog.getByLabelText(/^취소 사유/), '   ')
    await expect(dialog.getByRole('button', { name: '초대 취소' })).toBeDisabled()
    await userEvent.type(dialog.getByLabelText(/^취소 사유/), '가짜 계정')
    await userEvent.click(dialog.getByRole('button', { name: '초대 취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(await canvas.findByText('가짜 계정')).toBeVisible()
  },
}

export const ReadOnlyWithoutPermission: Story = {
  render: (args) => <AdminReferrals {...args} api={createFakeAdmin().api} can={() => false} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('table')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /더보기/ })).toBeNull()
  },
}
