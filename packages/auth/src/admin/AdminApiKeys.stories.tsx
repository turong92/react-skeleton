import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, waitFor, within } from 'storybook/test'
import { createFakeAdminApiKeysApi, FAKE_SCOPE_LABELS } from '../stories/fakeApiKeysApi'
import { WithQuery } from '../stories/WithQuery'
import { AdminApiKeys } from './AdminApiKeys'
import { koAdminApiKeysLabels } from './adminApiKeysLabels'

/**
 * 운영자 API 키 — 전체 키 표(주인 id · 상태로 걸러 보기, 「더 보기」)와 「회수」(사유 필수).
 * 권한: 읽기 `api-key.read`, 회수 `api-key.revoke` - 회수 권한이 없으면 단추가 없고, 읽기 권한이 없으면 안내만. 목록 화면(Patterns/목록)의 모양을 따른다
 */
const meta = {
  title: 'Packages/auth/admin/AdminApiKeys',
  component: AdminApiKeys,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeAdminApiKeysApi().api,
    scopeLabels: FAKE_SCOPE_LABELS,
    labels: koAdminApiKeysLabels,
    formatDate: (iso: string) => iso.slice(0, 10),
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminApiKeys>
export default meta
type Story = StoryObj<typeof meta>

export const ListWithMore: Story = {
  render: (args) => <AdminApiKeys {...args} api={createFakeAdminApiKeysApi().api} />,
  play: async ({ canvas, userEvent }) => {
    const table = await canvas.findByRole('table', { name: '모든 계정의 API 키' })
    await expect(within(table).getAllByRole('row')).toHaveLength(3)
    await userEvent.click(canvas.getByRole('button', { name: '더 보기' }))
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(5))
    await expect(within(table).getByText('운영자가 회수')).toBeVisible()
    await expect(within(table).getByText('사유: 유출 신고')).toBeVisible()
  },
}

export const FilterByStatus: Story = {
  render: (args) => <AdminApiKeys {...args} api={createFakeAdminApiKeysApi().api} />,
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('table')
    await userEvent.selectOptions(canvas.getByLabelText('상태'), '만료')
    await userEvent.click(canvas.getByRole('button', { name: '걸러 보기' }))
    const table = await canvas.findByRole('table')
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2))
  },
}

export const RevokeNeedsAReason: Story = {
  render: (args) => <AdminApiKeys {...args} api={createFakeAdminApiKeysApi().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'CI 서버(Ann) 회수' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'API 키 회수' }))
    await expect(dialog.getByRole('button', { name: '회수' })).toBeDisabled()
    await userEvent.type(dialog.getByLabelText(/^사유/), '   ')
    await expect(dialog.getByRole('button', { name: '회수' })).toBeDisabled()
    await userEvent.type(dialog.getByLabelText(/^사유/), '유출 신고')
    await userEvent.click(dialog.getByRole('button', { name: '회수' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() =>
      expect(canvas.queryByRole('button', { name: 'CI 서버(Ann) 회수' })).toBeNull(),
    )
  },
}

export const ReadOnlyWithoutRevoke: Story = {
  render: (args) => (
    <AdminApiKeys
      {...args}
      api={createFakeAdminApiKeysApi().api}
      can={(key) => key === 'api-key.read'}
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('table')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /회수$/ })).toBeNull()
  },
}

export const NoReadPermission: Story = {
  render: (args) => (
    <AdminApiKeys {...args} api={createFakeAdminApiKeysApi().api} can={() => false} />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('API 키를 볼 권한이 없어요.')).toBeVisible()
    await expect(canvas.queryByRole('table')).toBeNull()
  },
}
