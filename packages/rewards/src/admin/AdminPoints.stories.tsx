import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { createFakeAdmin, fakeSearchAccounts } from '../stories/fakeAdmin'
import { WithQuery } from '../stories/WithQuery'
import { AdminPoints } from './AdminPoints'
import { koRewardsAdminLabels } from './labels'

/**
 * 포인트 운영 — 계정 id 로 찾아 잔액 · 내역을 보고, 사유와 함께 조정한다. 더할 때만 유효기간 칸이 보이고,
 * 잔액보다 많이 빼면 서버가 409 `POINT.INSUFFICIENT` — 문장으로 보이고 잔액은 그대로.
 */
const meta = {
  title: 'Packages/rewards/admin/AdminPoints',
  component: AdminPoints,
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
} satisfies Meta<typeof AdminPoints>
export default meta
type Story = StoryObj<typeof meta>

async function find(
  canvas: Parameters<NonNullable<Story['play']>>[0]['canvas'],
  userEvent: Parameters<NonNullable<Story['play']>>[0]['userEvent'],
) {
  await userEvent.type(await canvas.findByLabelText('이메일 또는 로그인 아이디'), 'ada')
  await userEvent.click(canvas.getByRole('button', { name: '검색' }))
  await userEvent.click(await canvas.findByRole('button', { name: 'ada@example.com 고르기' }))
  await expect(await canvas.findByText('1,000 P')).toBeVisible()
}

export const AdjustDown: Story = {
  render: (args) => <AdminPoints {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await find(canvas, userEvent)
    await userEvent.type(canvas.getByLabelText(/^변경량/), '-5')
    await userEvent.type(canvas.getByLabelText('사유'), '잘못 준 포인트')
    await userEvent.click(canvas.getByRole('button', { name: '조정' }))
    await expect(await canvas.findByText('조정했어요.')).toBeVisible()
    await waitFor(() => expect(canvas.getByText('995 P')).toBeVisible())
    await expect(canvas.getByText('잘못 준 포인트')).toBeVisible()
  },
}

export const InsufficientSaysSo: Story = {
  render: (args) => <AdminPoints {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await find(canvas, userEvent)
    await userEvent.type(canvas.getByLabelText(/^변경량/), '-5000')
    await userEvent.type(canvas.getByLabelText('사유'), '회수')
    await userEvent.click(canvas.getByRole('button', { name: '조정' }))
    await expect(await canvas.findByText('잔액이 모자라 이만큼 뺄 수 없어요.')).toBeVisible()
    await expect(canvas.getByText('1,000 P')).toBeVisible()
  },
}

export const ExpiryOnlyWhenAdding: Story = {
  render: (args) => <AdminPoints {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await find(canvas, userEvent)
    await expect(canvas.queryByLabelText(/^유효기간/)).toBeNull()
    await userEvent.type(canvas.getByLabelText(/^변경량/), '100')
    await expect(canvas.getByLabelText(/^유효기간/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: '조정' })).toBeDisabled() // 사유가 비었다
  },
}

/** 계정 id 를 직접 적는 칸이 없다 - 검색해서 고르고, 「다른 계정 고르기」로 돌아간다 */
export const PickAnAccountFirst: Story = {
  render: (args) => <AdminPoints {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByLabelText('계정 id')).toBeNull()
    await expect(canvas.queryByText('잔액')).toBeNull()
    await find(canvas, userEvent)
    await userEvent.click(canvas.getByRole('button', { name: '다른 계정 고르기' }))
    await expect(await canvas.findByLabelText('이메일 또는 로그인 아이디')).toBeVisible()
  },
}
