import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { createFakeAdmin } from '../stories/fakeAdmin'
import { WithQuery } from '../stories/WithQuery'
import { AdminCouponDefinition } from './AdminCouponDefinition'
import { koRewardsAdminLabels } from './labels'

/**
 * 쿠폰 정의 한 건 — 혜택 · 상태 · 발행 기간 · 사용 기간, 현황 카드(상태별 수 + 깎아 준 금액), 발급 내역 표(상태 걸러 보기 · 「더 보기」 · 「회수」).
 * 계정 칸은 `renderAccountLink` 로 그 계정 화면에 잇는다.
 */
const meta = {
  title: 'Packages/rewards/admin/AdminCouponDefinition',
  component: AdminCouponDefinition,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeAdmin().api,
    definitionId: 'd1',
    labels: koRewardsAdminLabels,
    userLabels: koRewardsLabels,
    locale: 'ko-KR',
    formatTime: () => '2026. 10. 20.',
    renderAccountLink: (id, children) => <a href={`#/accounts/${id}`}>{children}</a>,
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminCouponDefinition>
export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {
  render: (args) => <AdminCouponDefinition {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: '무료 이용권' }),
    ).toBeVisible()
    await expect(canvas.getByText('발행 기간')).toBeVisible()
    await expect(canvas.getByText('사용 기간')).toBeVisible()
    const stats = within(await canvas.findByRole('region', { name: '현황' }))
    await expect(stats.getByText('발급').closest('dl')).toHaveTextContent('25')
    await expect(stats.getByText('사용함').closest('dl')).toHaveTextContent('4')
    await expect(stats.getByText('깎아 준 금액').closest('dl')).toHaveTextContent('12,000원')
  },
}

export const IssuedListFiltersAndPages: Story = {
  render: (args) => <AdminCouponDefinition {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    const table = within(await canvas.findByRole('table', { name: '이 쿠폰으로 발급한 내역' }))
    await expect(table.getAllByRole('row')).toHaveLength(21) // 머리 + 20
    await userEvent.click(canvas.getByRole('button', { name: '더 보기' }))
    await waitFor(() => expect(table.getAllByRole('row')).toHaveLength(26))
    await expect(canvas.queryByRole('button', { name: '더 보기' })).toBeNull()
    await userEvent.selectOptions(canvas.getByLabelText('상태'), 'USED')
    const rowsNow = () => within(canvas.getByRole('table')).getAllByRole('row')
    await waitFor(() => expect(rowsNow()).toHaveLength(5))
    const used = within(canvas.getByRole('table'))
    await expect(used.queryByRole('button', { name: /회수/ })).toBeNull()
    await expect(used.getAllByRole('link', { name: /acc_/ }).length).toBeGreaterThan(0)
  },
}

/** 쓸 수 있는 쿠폰만 「회수」 - 회수하면 현황의 「사용 가능」이 줄고 「회수」가 는다 */
export const RevokeUpdatesTheNumbers: Story = {
  render: (args) => <AdminCouponDefinition {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    const stats = within(await canvas.findByRole('region', { name: '현황' }))
    await expect(stats.getByText('회수').closest('dl')).toHaveTextContent('0')
    await userEvent.selectOptions(await canvas.findByLabelText('상태'), 'AVAILABLE')
    const first = (await canvas.findAllByRole('button', { name: /쿠폰 회수/ }))[0]!
    await userEvent.click(first)
    await waitFor(() => expect(stats.getByText('회수').closest('dl')).toHaveTextContent('1'))
  },
}

export const NoPermissionNoRevoke: Story = {
  render: (args) => (
    <AdminCouponDefinition {...args} api={createFakeAdmin().api} can={() => false} />
  ),
  play: async ({ canvas }) => {
    await canvas.findByRole('table')
    await expect(canvas.queryByRole('button', { name: /쿠폰 회수/ })).toBeNull()
  },
}

export const NotFound: Story = {
  render: (args) => (
    <AdminCouponDefinition {...args} api={createFakeAdmin().api} definitionId="nope" />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('이제 없는 쿠폰이에요.')).toBeVisible()
  },
}
