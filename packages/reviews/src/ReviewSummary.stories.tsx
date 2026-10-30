import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect } from 'storybook/test'
import { koReviewsLabels } from './labels'
import { targetSummary } from './test/fixtures'
import { ReviewSummary, type ReviewSummaryProps } from './ReviewSummary'
import type { Rating } from './types'

/**
 * 평균 · 별 · 리뷰 수와 1~5점 분포 막대. `onToggleRating` 을 주면 막대가 눌러서 거르는 단추가 된다
 * (같은 막대를 다시 누르면 풀린다 — `useReviewFilters().toggleRating` 을 그대로 꽂는다). 리뷰가 없는 별점은 눌리지 않는다.
 */
function FilterDemo(args: ReviewSummaryProps) {
  const [rating, setRating] = useState<Rating | undefined>()
  return (
    <ReviewSummary
      {...args}
      rating={rating}
      onToggleRating={(next) => setRating((current) => (current === next ? undefined : next))}
    />
  )
}

const meta = {
  title: 'Packages/reviews/ReviewSummary',
  component: ReviewSummary,
  args: { summary: targetSummary(), labels: koReviewsLabels },
} satisfies Meta<typeof ReviewSummary>
export default meta
type Story = StoryObj<typeof meta>

export const ReadOnly: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('4.3')).toBeVisible()
    await expect(canvas.getByText('리뷰 10개')).toBeVisible()
    await expect(canvas.getByRole('img', { name: '5점 만점에 4.3점' })).toBeVisible()
    await expect(canvas.queryAllByRole('button')).toHaveLength(0)
  },
}

export const PressABarToFilter: Story = {
  render: (args) => <FilterDemo {...args} />,
  play: async ({ canvas, userEvent }) => {
    const four = canvas.getByRole('button', { name: '4점 3개, 이 별점만 보기' })
    await expect(four).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(four)
    const pressed = canvas.getByRole('button', {
      name: '4점 3개, 이 별점만 보는 중, 누르면 전체 보기',
    })
    await expect(pressed).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(pressed)
    await expect(canvas.getByRole('button', { name: '4점 3개, 이 별점만 보기' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  },
}

export const BarWithNoReviewsCannotBePressed: Story = {
  args: { onToggleRating: () => undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '1점 0개, 이 별점만 보기' })).toBeDisabled()
  },
}

export const NoReviewsYet: Story = {
  args: {
    summary: targetSummary({
      count: 0,
      average: null,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('아직 리뷰가 없어요')).toBeVisible()
    await expect(canvas.queryAllByRole('button')).toHaveLength(0)
  },
}
