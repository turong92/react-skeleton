import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect } from 'storybook/test'
import { koReviewsLabels } from './labels'
import { RatingInput, type RatingInputProps } from './RatingInput'
import type { Rating } from './types'

/**
 * 별점 고르기 — 라디오 다섯 개의 묶음. 칸마다 테두리가 있고(눌리는 것으로 보인다) 고른 점수까지 별이 찬다.
 * 키보드: Tab 은 묶음에 한 번 멈추고, 화살표가 점수를 옮긴다. 이름은 「1점」~「5점」.
 */
function Controlled(args: RatingInputProps) {
  const [value, setValue] = useState<Rating | null>(args.value)
  return <RatingInput {...args} value={value} onChange={setValue} />
}

const meta = {
  title: 'Packages/reviews/RatingInput',
  component: RatingInput,
  args: { value: null, onChange: () => undefined, labels: koReviewsLabels },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof RatingInput>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const group = canvas.getByRole('group', { name: '별점' })
    await expect(group).toBeVisible()
    await expect(canvas.getAllByRole('radio')).toHaveLength(5)
    await userEvent.click(canvas.getByRole('radio', { name: '3점' }))
    await expect(canvas.getByRole('radio', { name: '3점' })).toBeChecked()
  },
}

export const ArrowKeysMoveTheScore: Story = {
  args: { value: 3 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await expect(canvas.getByRole('radio', { name: '3점' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(canvas.getByRole('radio', { name: '4점' })).toBeChecked()
    await expect(canvas.getByRole('radio', { name: '4점' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    await expect(canvas.getByRole('radio', { name: '2점' })).toBeChecked()
    await userEvent.keyboard('{ArrowDown}')
    await expect(canvas.getByRole('radio', { name: '3점' })).toBeChecked()
  },
}

export const TabStopsOnceInTheGroup: Story = {
  args: { value: 2 },
  render: (args) => (
    <>
      <Controlled {...args} />
      <button type="button">다음 칸</button>
    </>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await expect(canvas.getByRole('radio', { name: '2점' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: '다음 칸' })).toHaveFocus()
  },
}

export const Invalid: Story = {
  args: { invalid: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('group', { name: '별점' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  },
}

export const Disabled: Story = {
  args: { value: 4, disabled: true },
  play: async ({ canvas }) => {
    for (const radio of canvas.getAllByRole('radio')) await expect(radio).toBeDisabled()
  },
}
