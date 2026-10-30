import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { koReviewsLabels } from './labels'
import { ReviewList } from './ReviewList'
import { createFakeReviews } from './stories/fakeReviews'
import { WithQuery } from './stories/WithQuery'

/**
 * 대상 하나의 리뷰 목록 — 정렬 `Select` · 거르기 칩(구매 인증 · 사진 리뷰 · 별점) · 줄들 · 쪽 이동 · 빈 상태.
 * 조건을 바꾸면 첫 쪽으로 돌아가고, 새로 불러오는 동안 앞 쪽이 흐려진 채 남는다. `signedIn` 이 아니면 도움돼요 · 신고 단추가 없다.
 * 위쪽 `ReviewSummary` 의 분포 막대와 같은 조건을 쓰려면 `useReviewFilters()` 를 위에서 만들어 둘에 건넨다(`ReviewsPage` 스토리).
 */
const target = { type: 'product', id: 'sku-1' }
const meta = {
  title: 'Packages/reviews/ReviewList',
  component: ReviewList,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeReviews().api,
    target,
    labels: koReviewsLabels,
    locale: 'ko-KR',
    signedIn: true,
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof ReviewList>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findAllByRole('article')).toHaveLength(5)
    await expect(canvas.getByRole('combobox', { name: '정렬' })).toHaveValue('recent')
    await expect(canvas.getByRole('navigation', { name: '리뷰 쪽 이동' })).toBeVisible()
  },
}

export const SortChangesTheOrderAndGoesBackToPageOne: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findAllByRole('article')
    await userEvent.click(canvas.getByRole('button', { name: '2쪽' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: '2쪽' })).toHaveAttribute('aria-current', 'page'),
    )
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: '정렬' }), '별점 낮은순')
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: '1쪽' })).toHaveAttribute('aria-current', 'page'),
    )
    const first = (await canvas.findAllByRole('article'))[0]
    await expect(first.querySelector('[role="img"]')).toHaveAttribute(
      'aria-label',
      '5점 만점에 1점',
    )
  },
}

export const FilterChipsNarrowTheList: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findAllByRole('article')
    const photo = canvas.getByRole('button', { name: '사진 리뷰' })
    await expect(photo).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(photo)
    const pressed = await canvas.findByRole('button', { name: '✓ 사진 리뷰' })
    await expect(pressed).toHaveAttribute('aria-pressed', 'true')
    await waitFor(async () => {
      for (const article of canvas.getAllByRole('article'))
        await expect(article.querySelector('ul[aria-label="사진"]')).not.toBeNull()
    })
    await userEvent.click(canvas.getByRole('button', { name: '거르기 풀기' }))
    await expect(await canvas.findByRole('button', { name: '사진 리뷰' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  },
}

export const Empty: Story = {
  args: { api: createFakeReviews({ empty: true }).api },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('아직 리뷰가 없어요.')).toBeVisible()
    await expect(canvas.queryByRole('combobox')).toBeNull()
  },
}

export const HelpfulUpdatesInPlace: Story = {
  render: (args) => <ReviewList {...args} api={createFakeReviews().api} />,
  play: async ({ canvas, userEvent }) => {
    const buttons = await canvas.findAllByRole('button', { name: /^도움돼요/ })
    const before = buttons[0].textContent
    await userEvent.click(buttons[0])
    await waitFor(() => expect(canvas.getAllByRole('button', { pressed: true })[0]).toBeVisible())
    await expect(canvas.getAllByRole('button', { pressed: true })[0].textContent).not.toBe(before)
  },
}

export const SignedOutHasNoActions: Story = {
  args: { signedIn: false },
  play: async ({ canvas }) => {
    await canvas.findAllByRole('article')
    await expect(canvas.queryAllByRole('button', { name: /^도움돼요/ })).toHaveLength(0)
    await expect(canvas.queryAllByRole('button', { name: /더보기/ })).toHaveLength(0)
  },
}
