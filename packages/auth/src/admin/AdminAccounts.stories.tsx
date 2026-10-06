import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import type { AdminAccount } from '../account/types'
import { AdminAccountsTable } from './AdminAccountsTable'

/**
 * 운영자 계정 표(`@skeleton/auth/admin` — 선택). 검색 · 상태 필터 · 줄 메뉴(정지 · 해제 · 복구 · 역할). 백엔드는 `skeleton.account.admin.enabled=true` + ADMIN 역할일 때만 연다.
 * 정지는 사유를 받는 확인 창을 거친다.
 */
const account = (over: Partial<AdminAccount>): AdminAccount => ({
  id: 'acc_1',
  email: 'ann@example.com',
  status: 'ACTIVE',
  roles: ['USER'],
  displayName: 'Ann',
  createdAt: '2026-01-01T00:00:00Z',
  lastLoginAt: '2026-10-05T09:00:00Z',
  suspendedReason: null,
  purgeAfter: null,
  ...over,
})
const meta = {
  title: 'Patterns/Auth/Admin accounts',
  component: AdminAccountsTable,
  args: {
    accounts: [
      account({}),
      account({
        id: 'acc_2',
        email: 'bob@example.com',
        status: 'SUSPENDED',
        suspendedReason: 'spam',
      }),
      account({
        id: 'acc_3',
        email: 'cat@example.com',
        status: 'DELETED',
        purgeAfter: '2026-11-05T00:00:00Z',
      }),
    ],
    pagination: {
      page: 0,
      size: 20,
      totalElements: 3,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
    assignableRoles: ['ADMIN', 'MODERATOR'],
    query: { email: '', status: '' },
    onQueryChange: fn(),
    onPage: fn(),
    onSuspend: fn(async () => undefined),
    onUnsuspend: fn(async () => undefined),
    onRestore: fn(async () => undefined),
    onGrantRole: fn(async () => undefined),
    onRevokeRole: fn(async () => undefined),
  },
} satisfies Meta<typeof AdminAccountsTable>
export default meta
type Story = StoryObj<typeof AdminAccountsTable>

export const Table: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table', { name: 'Accounts' })).toBeVisible()
    await expect(canvas.getAllByText('Suspended').length).toBeGreaterThan(1) // 필터 옵션 + 상태 알약
    await expect(canvas.getByText(/spam/)).toBeVisible()
  },
}

export const SuspendWithReason: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'ann@example.com ⋯' }))
    await userEvent.click(await canvas.findByRole('menuitem', { name: 'Suspend' }))
    await userEvent.type(await canvas.findByLabelText(/Reason/), 'abuse')
    const confirm = (await canvas.findAllByRole('button', { name: 'Suspend' })).at(-1)!
    await userEvent.click(confirm)
    await expect(args.onSuspend).toHaveBeenCalledWith('acc_1', 'abuse')
  },
}

export const RestoreDeleted: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'cat@example.com ⋯' }))
    await userEvent.click(await canvas.findByRole('menuitem', { name: 'Restore' }))
    await expect(args.onRestore).toHaveBeenCalledWith('acc_3')
  },
}

export const Empty: Story = {
  args: { accounts: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No accounts match.')).toBeVisible()
  },
}
