import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, waitFor, within } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { createFakeAdmin, fakeSearchAccounts } from '../stories/fakeAdmin'
import { fail } from '../stories/fakeRewards'
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
    searchAccounts: fakeSearchAccounts,
    renderDetailLink: (definition, label, accessibleName, className) => (
      <a href={`#/coupons/${definition.id}`} className={className} aria-label={accessibleName}>
        {label}
      </a>
    ),
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
    await expect(table.getByText('25')).toBeVisible()
    // 줄 끝 「자세히」 는 테두리 있는 링크 단추 모양이다
    await expect(table.getByRole('link', { name: '자세히: 무료 이용권' })).toBeVisible()
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
    // 계정 id 를 적는 칸이 없다 - 검색해서 골라 담는다
    await expect(issue.queryByLabelText('계정 id')).toBeNull()
    await userEvent.type(issue.getByLabelText('이메일 또는 로그인 아이디'), 'example.com')
    await userEvent.click(issue.getByRole('button', { name: '검색' }))
    await userEvent.click(await issue.findByRole('button', { name: 'ada@example.com 고르기' }))
    await userEvent.click(await issue.findByRole('button', { name: 'bob@example.com 고르기' }))
    await userEvent.click(await issue.findByRole('button', { name: 'skip@example.com 고르기' }))
    await expect(issue.getByRole('button', { name: '빼기: ada@example.com' })).toBeVisible()
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

/** 계정의 쿠폰 - 계정 id 칸이 없다: 이메일(조각) · 로그인 아이디로 찾고, 결과에서 계정을 골라야 목록이 열린다 */
export const LookUpAnAccountsCoupons: Story = {
  render: (args) => <AdminCouponDefinitions {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByLabelText('계정 id')).toBeNull()
    await userEvent.type(await canvas.findByLabelText('이메일 또는 로그인 아이디'), 'ada')
    await userEvent.click(canvas.getByRole('button', { name: '검색' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'ada@example.com 고르기' }))
    const table = within(await canvas.findByRole('table', { name: '계정의 쿠폰 목록' }))
    await expect(table.getAllByText('무료 이용권').length).toBeGreaterThan(0)
    await userEvent.click(table.getAllByRole('button', { name: /회수/ })[0]!)
    await waitFor(() => expect(table.getAllByText('회수됨').length).toBeGreaterThan(0))
    await userEvent.click(canvas.getByRole('button', { name: '다른 계정 고르기' }))
    await expect(await canvas.findByLabelText('이메일 또는 로그인 아이디')).toBeVisible()
  },
}

export const NoAccountFound: Story = {
  render: (args) => <AdminCouponDefinitions {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('이메일 또는 로그인 아이디'), 'nobody')
    await userEvent.click(canvas.getByRole('button', { name: '검색' }))
    await expect(await canvas.findByText('찾는 계정이 없어요.')).toBeVisible()
  },
}

/** 만들기에 발행 기간 · 사용 시작 - 순서가 거꾸로면 이유가 보이고 저장이 막힌다 */
export const PeriodsMustBeInOrder: Story = {
  render: (args) => <AdminCouponDefinitions {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '쿠폰 만들기' }))
    const dialog = within(await screen.findByRole('dialog', { name: '쿠폰 만들기' }))
    await userEvent.type(dialog.getByLabelText(/^이름/), '기간 쿠폰')
    const save = dialog.getByRole('button', { name: '저장' })
    await expect(save).toBeEnabled()
    await userEvent.type(dialog.getByLabelText('발행 시작'), '2026-12-02T10:00')
    await userEvent.type(dialog.getByLabelText('발행 끝'), '2026-12-01T10:00')
    await expect(dialog.getByText('발행 시작이 발행 끝보다 앞이어야 해요.')).toBeVisible()
    await expect(save).toBeDisabled()
    await userEvent.clear(dialog.getByLabelText('발행 끝'))
    await userEvent.type(dialog.getByLabelText('발행 끝'), '2026-12-31T10:00')
    await expect(save).toBeEnabled()
    await userEvent.type(dialog.getByLabelText('사용 시작'), '2027-01-02T10:00')
    await userEvent.type(dialog.getByLabelText('유효기간 끝'), '2027-01-01T10:00')
    await expect(dialog.getByText('사용 시작이 유효기간 끝보다 앞이어야 해요.')).toBeVisible()
    await expect(save).toBeDisabled()
  },
}

/** 계정 조회 권한이 없는 운영자(`searchAccounts` 를 못 받는다) - 「계정에 주기」 단추 대신 이유를 보인다 */
export const WithoutAccountLookup: Story = {
  render: (args) => (
    <AdminCouponDefinitions {...args} api={createFakeAdmin().api} searchAccounts={undefined} />
  ),
  play: async ({ canvas }) => {
    const table = within(await canvas.findByRole('table', { name: '쿠폰 정의 목록' }))
    await expect(table.queryByRole('button', { name: /계정에 주기/ })).toBeNull()
    await expect(
      canvas.getByText('계정을 찾으려면 계정 조회 권한(account.read)이 필요해요.'),
    ).toBeVisible()
    await expect(canvas.queryByLabelText('이메일 또는 로그인 아이디')).toBeNull()
  },
}

/** 검색이 403(권한 없음)이면 「실패」가 아니라 권한이 필요하다고 말한다 */
export const SearchDeniedSaysWhy: Story = {
  render: (args) => (
    <AdminCouponDefinitions
      {...args}
      api={createFakeAdmin().api}
      searchAccounts={async () => {
        throw fail(403, 'COMMON.FORBIDDEN')
      }}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('이메일 또는 로그인 아이디'), 'ada')
    await userEvent.click(canvas.getByRole('button', { name: '검색' }))
    await expect(
      await canvas.findByText('계정을 찾으려면 계정 조회 권한(account.read)이 필요해요.'),
    ).toBeVisible()
  },
}

/** 결과가 한도(10)를 넘으면 열 개만 보이고 「더 좁혀서 찾아 주세요」 */
export const TooManyMatches: Story = {
  render: (args) => (
    <AdminCouponDefinitions
      {...args}
      api={createFakeAdmin().api}
      searchAccounts={async () =>
        Array.from({ length: 11 }, (_, i) => ({ id: `a${i}`, email: `user${i}@example.com` }))
      }
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('이메일 또는 로그인 아이디'), 'user')
    await userEvent.click(canvas.getByRole('button', { name: '검색' }))
    await expect(await canvas.findByText('결과가 더 있어요. 더 좁혀서 찾아 주세요.')).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: /고르기$/ })).toHaveLength(10)
  },
}

/** 검색이 404(계정 도구가 꺼진 서버)면 권한이 아니라 도구가 꺼졌다고 말한다 */
export const SearchToolOffSaysSo: Story = {
  render: (args) => (
    <AdminCouponDefinitions
      {...args}
      api={createFakeAdmin().api}
      searchAccounts={async () => {
        throw fail(404, 'COMMON.NOT_FOUND')
      }}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('이메일 또는 로그인 아이디'), 'ada')
    await userEvent.click(canvas.getByRole('button', { name: '검색' }))
    await expect(
      await canvas.findByText('이 서버에서는 계정 조회 도구가 꺼져 있어요.'),
    ).toBeVisible()
    await expect(canvas.queryByText(/account\.read/)).toBeNull()
  },
}
