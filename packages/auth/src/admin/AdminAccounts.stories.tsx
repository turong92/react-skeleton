import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor, within } from 'storybook/test'
import { ApiRequestError } from '@skeleton/api-client'
import type { AdminAccount } from '../account/types'
import { koAuthLabels } from '../screens/labels.ko'
import { AdminAccounts } from './AdminAccounts'
import type { AdminAccountsApi } from './adminApi'
import { AdminAccountsTable } from './AdminAccountsTable'
import type { ApiPageResponse } from '@skeleton/api-client'

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

/** 토큰은 아직 관리자 토큰이어도, 저장된 계정이 더는 활성 관리자가 아니면 백엔드는 403 — 로그아웃 없이 「접근 차단」 */
export const BlockedAdmin: StoryObj = {
  render: () => {
    const forbidden = () =>
      Promise.reject(
        new ApiRequestError(
          { code: 'COMMON.FORBIDDEN', title: 'Forbidden', status: 403, timestamp: 't' },
          'trace',
          'span',
          'tp',
        ),
      )
    return (
      <AdminAccounts
        api={{ list: forbidden, get: forbidden } as unknown as AdminAccountsApi}
        assignableRoles={['ADMIN']}
      />
    )
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Access blocked' })).toBeVisible()
    await expect(canvas.queryByRole('table')).toBeNull()
  },
}

// ───────────────────────── 로그인 아이디 (서버가 켠 앱: 응답에 loginId 키가 있다) ─────────────────────────

const withIds: AdminAccount[] = [
  account({ loginId: 'ann.lee' }),
  account({ id: 'acc_2', email: null, displayName: 'Bob', loginId: 'bob_kim' }),
  account({ id: 'acc_3', email: 'cat@example.com', displayName: 'Cat', loginId: null }),
]

/** 표에 「아이디」 열(아직 안 정한 계정은 `-`)과 「아이디로 찾기」 칸이 생긴다 — 응답에 키가 있을 때만 */
export const TableWithLoginIdColumn: Story = {
  args: { accounts: withIds, query: { email: '', status: '', loginId: '' } },
  play: async ({ canvas, args, userEvent }) => {
    const table = within(canvas.getByRole('table', { name: 'Accounts' }))
    await expect(table.getByRole('columnheader', { name: 'Username' })).toBeVisible()
    await expect(table.getByText('ann.lee')).toBeVisible()
    await expect(table.getByText('bob_kim')).toBeVisible()
    const box = canvas.getByRole('searchbox', { name: /^Find by username/ })
    // 입력하는 동안은 질의가 나가지 않는다 - Enter 나 「Find」 단추로 낸다
    await userEvent.type(box, 'a')
    await expect(args.onQueryChange).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    await expect(args.onQueryChange).toHaveBeenLastCalledWith({
      email: '',
      status: '',
      loginId: 'a',
    })
    // 단추도 같다: 눌리게 보이고(테두리) 같은 길로 낸다
    const find = canvas.getByRole('button', { name: 'Find' })
    await expect(find).toHaveAttribute('data-variant', 'secondary')
    await userEvent.type(box, 'b')
    await userEvent.click(find)
    await expect(args.onQueryChange).toHaveBeenLastCalledWith({
      email: '',
      status: '',
      loginId: 'ab',
    })
  },
}

/** 키가 없는 서버(아이디를 안 쓴다)에서는 열도 찾기 칸도 없다 — 지금 표 그대로 */
export const NoLoginIdColumnWhenTheServerHasItOff: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('columnheader', { name: 'Username' })).toBeNull()
    await expect(canvas.queryByRole('searchbox', { name: /Find by username/ })).toBeNull()
    await expect(canvas.getByRole('searchbox', { name: 'Search by email' })).toBeVisible()
  },
}

/** 한국어 */
export const LoginIdColumnKorean: Story = {
  args: { accounts: withIds, labels: koAuthLabels },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('columnheader', { name: '아이디' })).toBeVisible()
    await expect(canvas.getByRole('searchbox', { name: /^아이디로 찾기/ })).toBeVisible()
  },
}

/** 휴대폰 폭(320px) — 열이 늘어도 페이지가 가로로 밀리지 않는다(표는 자기 칸 안에서 가로로 움직인다) */
export const LoginIdColumnFitsTheNarrowestPhone: Story = {
  args: { accounts: withIds },
  decorators: [
    (Story) => (
      <div data-testid="phone" style={{ inlineSize: 320, overflow: 'hidden' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const phone = canvas.getByTestId('phone')
    await expect(phone.scrollWidth).toBeLessThanOrEqual(phone.clientWidth)
    await expect(canvas.getByRole('searchbox', { name: /^Find by username/ })).toBeVisible()
  },
}

const idPage = (values: AdminAccount[]): ApiPageResponse<AdminAccount> => ({
  values,
  pagination: {
    page: 0,
    size: 20,
    totalElements: values.length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  },
  meta: { timestamp: '2026-01-01T00:00:00Z' },
})
/** 정확히 일치만 돌려주는 가짜 서버 — 화면이 바뀌어도 같은 객체라 목록을 다시 부르는 루프가 생기지 않는다 */
const exactLookupApi = {
  list: async (query?: { loginId?: string }) =>
    idPage(query?.loginId ? withIds.filter((a) => a.loginId === query.loginId) : withIds),
} as unknown as AdminAccountsApi

/** 목록을 부르는 화면: 아이디로 찾기는 **정확히 일치**만 — 조각은 찾지 않는다. 결과가 비어도 찾기 칸은 남는다 */
export const FindByExactLoginId: StoryObj = {
  render: () => <AdminAccounts api={exactLookupApi} assignableRoles={['ADMIN']} />,
  play: async ({ canvas, userEvent }) => {
    const box = await canvas.findByRole('searchbox', { name: /^Find by username/ })
    await expect(await canvas.findByText('bob_kim')).toBeVisible()
    await userEvent.type(box, 'bob_kim{Enter}')
    await waitFor(() => expect(canvas.queryByText('ann.lee')).toBeNull())
    await expect(canvas.getByText('bob_kim')).toBeVisible()
    // 조각은 찾지 않는다 - 비면 비었다고 말하고, 찾기 칸은 그대로 남아 고칠 수 있다
    await userEvent.clear(box)
    await userEvent.type(box, 'bob{Enter}')
    await expect(await canvas.findByText('No accounts match.')).toBeVisible()
    await expect(canvas.getByRole('searchbox', { name: /^Find by username/ })).toHaveValue('bob')
  },
}

/** 입력 중에는 서버에 가지 않는다 - 정확 일치라 글자마다 묻는 질의는 늘 빈 결과이고, 아이디 조각이 주소 · 로그에 남는다 */
export const TypingDoesNotQueryTheServerUntilEnter: StoryObj = {
  render: () => {
    const asked: Array<string | undefined> = []
    const api = {
      list: async (query?: { loginId?: string }) => {
        asked.push(query?.loginId)
        document.body.dataset.asked = JSON.stringify(asked)
        return idPage(query?.loginId ? withIds.filter((a) => a.loginId === query.loginId) : withIds)
      },
    } as unknown as AdminAccountsApi
    return <AdminAccounts api={api} assignableRoles={['ADMIN']} />
  },
  play: async ({ canvas, userEvent }) => {
    const box = await canvas.findByRole('searchbox', { name: /^Find by username/ })
    await canvas.findByText('bob_kim')
    await userEvent.type(box, 'bob_kim')
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(JSON.parse(document.body.dataset.asked ?? '[]')).toEqual([null]) // 처음 목록 한 번뿐
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(JSON.parse(document.body.dataset.asked ?? '[]')).toEqual([null, 'bob_kim']),
    )
    // 비우면 거름이 풀린다
    await userEvent.clear(box)
    await waitFor(() => expect(JSON.parse(document.body.dataset.asked ?? '[]')).toHaveLength(3))
    await expect(await canvas.findByText('ann.lee')).toBeVisible()
  },
}

/** 표만 쓸 때도 같다 - 정확히 일치하는 아이디가 없어 비었어도 찾기 칸과 입력한 값이 남는다 */
export const EmptyLookupKeepsTheBox: Story = {
  args: { accounts: [], showLoginId: true, query: { email: '', status: '', loginId: 'nobody' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No accounts match.')).toBeVisible()
    await expect(canvas.getByRole('searchbox', { name: /^Find by username/ })).toHaveValue('nobody')
  },
}
