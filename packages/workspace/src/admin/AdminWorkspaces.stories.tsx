import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { createFakeWorkspaceAdmin } from '../stories/fakeWorkspaceAdmin'
import { WithQuery } from '../stories/WithQuery'
import { AdminWorkspaces } from './AdminWorkspaces'
import { koWorkspaceAdminLabels } from './labels'

/**
 * 운영자의 워크스페이스 목록 — 이름 · 주소 이름 검색, 「더 보기」(커서), 「자세히」(멤버 표 · 기다리는 초대 수). 읽기만 한다.
 * `can('workspace.read')` 가 거짓이면 목록 대신 안내만 보인다
 */
const meta = {
  title: 'Packages/workspace/admin/AdminWorkspaces',
  component: AdminWorkspaces,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeWorkspaceAdmin().api,
    labels: koWorkspaceAdminLabels,
    locale: 'ko-KR',
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminWorkspaces>
export default meta
type Story = StoryObj<typeof meta>

export const ListsWorkspacesWithOwnerCountAndStatus: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Acme')).toBeVisible()
    await expect(canvas.getByText('Olive')).toBeVisible()
    await expect(canvas.getAllByText('사용 중').length).toBeGreaterThan(0)
    await expect(canvas.getByText('닫힘')).toBeVisible()
    await expect(canvas.getByText('소유자 없음')).toBeVisible()
  },
}

export const SearchNarrowsTheList: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('이름 · 주소 이름으로 검색'), 'globex')
    await userEvent.click(canvas.getByRole('button', { name: '검색' }))
    await expect(await canvas.findByText('Globex')).toBeVisible()
    await expect(canvas.queryByText('Acme')).toBeNull()
  },
}

export const MoreLoadsTheNextCursorPage: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('Acme')).toBeVisible()
    await expect(canvas.queryByText('Team 22')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: '더 보기' }))
    await expect(await canvas.findByText('Team 22')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '더 보기' })).toBeNull()
  },
}

export const DetailShowsMembersAndPendingInvitationsReadOnly: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Acme 자세히 보기' }))
    const dialog = await within(document.body).findByRole('dialog', { name: 'Acme' })
    await expect(await within(dialog).findByText('기다리는 초대 2건')).toBeVisible()
    await expect(within(dialog).getByText('이름 없는 멤버')).toBeVisible()
    await expect(
      within(dialog).queryByRole('button', { name: /내보내기|삭제|닫기 처리/ }),
    ).toBeNull()
  },
}

export const WithoutTheReadPermissionOnlyAHintShows: Story = {
  args: { can: () => false },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/workspace.read 권한이 필요해요/)).toBeVisible()
    await expect(canvas.queryByRole('table')).toBeNull()
  },
}
