import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, waitFor, within } from 'storybook/test'
import { createFakeAdmin, fakeSearchAccounts } from '../stories/fakeAdmin'
import { WithQuery } from '../stories/WithQuery'
import { AdminBadgeAwards } from './AdminBadgeAwards'
import { koRewardsAdminLabels } from './labels'

/**
 * 배지 수여 · 회수 내역 — 최신순 표, 배지 · 계정으로 걸러 보기, 「더 보기」, 「회수」(사유 필수).
 * 이미 회수된 보유 줄에는 회수 단추가 없다. `can('badge.manage')` 가 거짓이면 단추가 없다.
 */
const meta = {
  title: 'Packages/rewards/admin/AdminBadgeAwards',
  component: AdminBadgeAwards,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeAdmin().api,
    searchAccounts: fakeSearchAccounts,
    labels: koRewardsAdminLabels,
    locale: 'ko-KR',
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminBadgeAwards>
export default meta
type Story = StoryObj<typeof meta>

export const HistoryWithMore: Story = {
  render: (args) => <AdminBadgeAwards {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    const table = await canvas.findByRole('table', { name: '배지 수여 · 회수 내역' })
    await expect(within(table).getAllByRole('row')).toHaveLength(3)
    await userEvent.click(canvas.getByRole('button', { name: '더 보기' }))
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(4))
  },
}

export const RevokeNeedsAReason: Story = {
  render: (args) => <AdminBadgeAwards {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /^더 보기/ }))
    // 이미 회수된 줄(w2)에는 단추가 없고, 아직 가진 줄(w1)에만 있다
    const buttons = await canvas.findAllByRole('button', { name: /^회수:/ })
    await expect(buttons).toHaveLength(1)
    await userEvent.click(buttons[0])
    const dialog = within(await screen.findByRole('dialog', { name: '배지 회수' }))
    await expect(dialog.getByRole('button', { name: '회수' })).toBeDisabled()
    await userEvent.type(dialog.getByLabelText(/^회수 사유/), '   ')
    await expect(dialog.getByRole('button', { name: '회수' })).toBeDisabled()
    await userEvent.type(dialog.getByLabelText(/^회수 사유/), '약관 위반')
    await userEvent.click(dialog.getByRole('button', { name: '회수' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect((await canvas.findAllByText('약관 위반')).length).toBeGreaterThan(0)
  },
}

export const FilterByBadge: Story = {
  render: (args) => <AdminBadgeAwards {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(await canvas.findByLabelText('배지'), '올빼미')
    await expect(await canvas.findByText('아직 내역이 없어요.')).toBeVisible()
  },
}

export const ReadOnlyWithoutPermission: Story = {
  render: (args) => <AdminBadgeAwards {...args} api={createFakeAdmin().api} can={() => false} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('table')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /^회수:/ })).toBeNull()
  },
}
