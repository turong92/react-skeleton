import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, waitFor, within } from 'storybook/test'
import { createFakeAdmin, fakeSearchAccounts } from '../stories/fakeAdmin'
import { WithQuery } from '../stories/WithQuery'
import { AdminBadges } from './AdminBadges'
import { koRewardsAdminLabels } from './labels'

/**
 * 배지 운영 — 목록(보유자 수) · 만들기 · 고치기(코드는 잠긴다) · 보관 / 되살리기 · 수동 수여(계정 찾기).
 * `can('badge.manage')` 가 거짓이면 단추가 없다(서버도 403). 모듈의 `admin.enabled` 가 꺼진 서버(404)는 안내만.
 */
const meta = {
  title: 'Packages/rewards/admin/AdminBadges',
  component: AdminBadges,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeAdmin().api,
    searchAccounts: fakeSearchAccounts,
    labels: koRewardsAdminLabels,
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminBadges>
export default meta
type Story = StoryObj<typeof meta>

export const List: Story = {
  render: (args) => <AdminBadges {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas }) => {
    const table = within(await canvas.findByRole('table', { name: '배지 목록' }))
    await expect(table.getByText('early-bird')).toBeVisible()
    await expect(table.getByText('보관됨')).toBeVisible()
    // 보관된 배지는 수여 단추가 없다
    await expect(table.getAllByRole('button', { name: /^수동 수여/ })).toHaveLength(1)
  },
}

export const CreateNeedsAValidCode: Story = {
  render: (args) => <AdminBadges {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '배지 만들기' }))
    const dialog = within(await screen.findByRole('dialog', { name: '배지 만들기' }))
    await userEvent.type(dialog.getByLabelText(/^이름/), '열 번째 노트')
    await userEvent.type(dialog.getByLabelText(/^코드/), 'Bad Code')
    await expect(dialog.getByRole('button', { name: '저장' })).toBeDisabled()
    await userEvent.clear(dialog.getByLabelText(/^코드/))
    await userEvent.type(dialog.getByLabelText(/^코드/), 'writer-10')
    await userEvent.click(dialog.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(await canvas.findByText('writer-10')).toBeVisible()
  },
}

export const TakenCodeIsExplained: Story = {
  render: (args) => <AdminBadges {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '배지 만들기' }))
    const dialog = within(await screen.findByRole('dialog', { name: '배지 만들기' }))
    await userEvent.type(dialog.getByLabelText(/^이름/), '또 얼리 버드')
    await userEvent.type(dialog.getByLabelText(/^코드/), 'early-bird')
    await userEvent.click(dialog.getByRole('button', { name: '저장' }))
    await expect(
      await dialog.findByText('이미 쓰는 코드예요. 다른 코드로 바꿔 주세요.'),
    ).toBeVisible()
  },
}

export const EditLocksTheCode: Story = {
  render: (args) => <AdminBadges {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '고치기: 얼리 버드' }))
    const dialog = within(await screen.findByRole('dialog', { name: '얼리 버드 고치기' }))
    await expect(dialog.getByLabelText(/^코드/)).toBeDisabled()
  },
}

export const ArchiveAndRestore: Story = {
  render: (args) => <AdminBadges {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '보관: 얼리 버드' }))
    await userEvent.click(await canvas.findByRole('button', { name: '되살리기: 얼리 버드' }))
    await expect(await canvas.findByRole('button', { name: '보관: 얼리 버드' })).toBeVisible()
  },
}

export const AwardByHand: Story = {
  render: (args) => <AdminBadges {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '수동 수여: 얼리 버드' }))
    const dialog = within(await screen.findByRole('dialog', { name: '얼리 버드 수여' }))
    await expect(dialog.getByRole('button', { name: '수동 수여' })).toBeDisabled()
    await userEvent.type(dialog.getByLabelText('이메일 또는 로그인 아이디'), 'example.com')
    await userEvent.click(dialog.getByRole('button', { name: '검색' }))
    await userEvent.click(await dialog.findByRole('button', { name: /ada@example.com/ }))
    await userEvent.click(await dialog.findByRole('button', { name: /bob@example.com/ }))
    await userEvent.click(dialog.getByRole('button', { name: '수동 수여' }))
    await expect(await dialog.findByText(/1명 수여 · 1명 이미 보유/)).toBeVisible()
    // 선택을 비운 뒤에도 이미 가진 사람은 이름으로 보인다
    await expect(dialog.getByText(/이미 가진 사람: ada@example.com/)).toBeVisible()
  },
}

export const ReadOnlyWithoutPermission: Story = {
  render: (args) => <AdminBadges {...args} api={createFakeAdmin().api} can={() => false} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('table')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '배지 만들기' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: /고치기/ })).toBeNull()
  },
}
