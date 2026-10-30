import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { koReviewsLabels } from './labels'
import { RatingStars } from './RatingStars'

/**
 * 별점 표시 — 별은 장식이고 읽는 이름은 「5점 만점에 4.3점」 하나다. 평균은 소수 한 자리까지 별이 부분으로 찬다.
 * 리뷰가 아직 없으면 `value={null}` - 0점이 아니라 「아직 평점이 없어요」.
 */
const meta = {
  title: 'Packages/reviews/RatingStars',
  component: RatingStars,
  args: { value: 4.3, labels: koReviewsLabels, showValue: true },
} satisfies Meta<typeof RatingStars>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: '5점 만점에 4.3점' })).toBeVisible()
    await expect(canvas.getByText('4.3')).toBeVisible()
  },
}

export const WholeNumber: Story = {
  args: { value: 4, showValue: false },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: '5점 만점에 4점' })).toBeVisible()
  },
}

export const NoRatingYet: Story = {
  args: { value: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: '아직 평점이 없어요' })).toBeVisible()
  },
}

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <RatingStars {...args} size="sm" />
      <RatingStars {...args} size="md" />
      <RatingStars {...args} size="lg" />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('img', { name: '5점 만점에 4.3점' })).toHaveLength(3)
  },
}
