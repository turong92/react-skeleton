import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, waitFor, within } from 'storybook/test'
import { WithQuery } from '../stories/WithQuery'
import { AdminReviewQueue } from './AdminReviewQueue'
import { koReviewsAdminLabels } from './labels'
import { createFakeAdmin } from './stories/fakeAdmin'

/**
 * 리뷰 운영 큐 — 신고됨 · 숨김 · 전체 표, 사유 칩, 「숨기기」(사유 필수 대화상자) · 「문제없음」 · 「되살리기」 · 「답글」.
 * 단추는 `can('review.moderate')` · `can('review.reply')` 로 갈린다.
 */
const meta = {
  title: 'Packages/reviews/admin/AdminReviewQueue',
  component: AdminReviewQueue,
  parameters: { layout: 'padded' },
  args: { api: createFakeAdmin().api, labels: koReviewsAdminLabels, locale: 'ko-KR' },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminReviewQueue>
export default meta
type Story = StoryObj<typeof meta>

const rowOf = (canvas: ReturnType<typeof within>, text: RegExp) =>
  within(canvas.getByText(text).closest('tr') as HTMLElement)

export const ReportedQueueShowsReasonChips: Story = {
  render: (args) => <AdminReviewQueue {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas }) => {
    const table = await canvas.findByRole('table', { name: '관리할 리뷰' })
    // 신고 큐: 신고가 있는 공개 리뷰 둘 (숨긴 것 · 신고 없는 것은 없다)
    await expect(within(table).getAllByRole('row')).toHaveLength(3)
    await expect(within(table).getByText('스팸 · 광고 2')).toBeVisible()
    await expect(within(table).getByText('욕설 · 비하 1')).toBeVisible()
    await expect(within(table).getByText('3건')).toBeVisible()
  },
}

export const HideNeedsAReason: Story = {
  render: (args) => {
    const fake = createFakeAdmin()
    return <AdminReviewQueue {...args} api={fake.api} />
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /^숨기기: 광고 링크/ }))
    const dialog = within(await screen.findByRole('dialog', { name: '리뷰 숨기기' }))
    const submit = dialog.getByRole('button', { name: '숨기기' })
    await expect(submit).toBeDisabled()
    await userEvent.type(dialog.getByLabelText(/^숨기는 사유/), '   ')
    await expect(submit).toBeDisabled()
    await userEvent.type(dialog.getByLabelText(/^숨기는 사유/), '광고')
    await expect(submit).toBeEnabled()
    await userEvent.click(submit)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // 큐에서 사라졌다
    await waitFor(() => expect(canvas.queryByText(/광고 링크/)).toBeNull())
  },
}

export const DismissLeavesTheQueue: Story = {
  render: (args) => <AdminReviewQueue {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /^문제없음: 배송이 빠르고/ }))
    await waitFor(() => expect(canvas.queryByText(/배송이 빠르고/)).toBeNull())
    await expect(canvas.getByText(/광고 링크/)).toBeVisible()
  },
}

export const RestoreFromTheHiddenQueue: Story = {
  render: (args) => (
    <AdminReviewQueue {...args} api={createFakeAdmin().api} initialQueue="hidden" />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('사유: 욕설')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /^되살리기: / }))
    await expect(await canvas.findByText('숨긴 리뷰가 없어요.')).toBeVisible()
  },
}

export const ReplyThenEditThenDelete: Story = {
  render: (args) => <AdminReviewQueue {...args} api={createFakeAdmin().api} initialQueue="all" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /^답글: 신고는 없지만/ }))
    const dialog = within(await screen.findByRole('dialog', { name: '리뷰에 답글' }))
    await userEvent.click(dialog.getByRole('button', { name: '답글 저장' }))
    await expect(await dialog.findByText('답글을 적어 주세요.')).toBeVisible()
    await userEvent.type(dialog.getByLabelText(/^답글/), '소중한 후기 감사합니다')
    await userEvent.click(dialog.getByRole('button', { name: '답글 저장' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(await rowOf(canvas, /신고는 없지만/).findByText('답글 있음')).toBeVisible()
    // 다시 열면 그 글이 들어 있고, 지우면 표시가 사라진다
    await userEvent.click(canvas.getByRole('button', { name: /^답글: 신고는 없지만/ }))
    const again = within(await screen.findByRole('dialog', { name: '리뷰에 답글' }))
    await expect(again.getByLabelText(/^답글/)).toHaveValue('소중한 후기 감사합니다')
    await userEvent.click(again.getByRole('button', { name: '답글 삭제' }))
    const confirm = within(await screen.findByRole('dialog', { name: '답글을 지울까요?' }))
    await userEvent.click(confirm.getByRole('button', { name: '답글 삭제' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(rowOf(canvas, /신고는 없지만/).queryByText('답글 있음')).toBeNull())
  },
}

export const ButtonsFollowPermissions: Story = {
  args: { can: (key: string) => key === 'review.reply', initialQueue: 'all' },
  render: (args) => <AdminReviewQueue {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas }) => {
    await canvas.findAllByRole('button', { name: /^답글: / })
    await expect(canvas.queryByRole('button', { name: /^숨기기: / })).toBeNull()
    await expect(canvas.queryByRole('button', { name: /^문제없음: / })).toBeNull()
    await expect(canvas.queryByRole('button', { name: /^되살리기: / })).toBeNull()
  },
}

export const ToolIsOffOnTheServer: Story = {
  render: (args) => <AdminReviewQueue {...args} api={createFakeAdmin({ failWith: 404 }).api} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('서버에서 이 도구가 꺼져 있어요.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '다시 시도' })).toBeNull()
  },
}
