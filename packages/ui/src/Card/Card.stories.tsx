import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Button } from '../Button/Button'
import { Card } from './Card'

/** 묶음 하나를 담는 면. `title` 이 있으면 그 제목이 영역의 이름이 되고(`<section aria-labelledby>`), `actions` 는 제목 줄 오른쪽에 놓인다. */
const meta = {
  title: 'UI/Card',
  component: Card,
  args: { title: 'Billing', children: <p>Your plan renews on the first of every month.</p> },
} satisfies Meta<typeof Card>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    const region = canvas.getByRole('region', { name: 'Billing' })
    await expect(region).toHaveTextContent('renews on the first')
    await expect(canvas.getByRole('heading', { level: 2, name: 'Billing' })).toBeVisible()
  },
}

export const WithActions: Story = {
  args: {
    actions: (
      <Button size="sm" variant="secondary">
        Change plan
      </Button>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Change plan' })).toBeVisible()
  },
}

export const WithoutTitle: Story = {
  args: { title: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('heading')).toBeNull()
    await expect(canvas.getByText(/renews/)).toBeVisible()
  },
}

export const LongTitle: Story = {
  args: {
    title:
      'A card title that is so long that it has to wrap onto several lines inside a narrow column',
    actions: <Button size="sm">Edit</Button>,
  },
  render: (args) => (
    <div style={{ maxWidth: '20rem' }}>
      <Card {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeVisible()
  },
}

/** 끊을 곳이 없는 긴 낱말(공백 없는 이름 · 주소)이 제목 줄에서 삐져나가지 않는다 — 제목이 줄을 바꾸고 `actions` 는 아래로 내려간다 */
export const UnbreakableTitleStaysInside: Story = {
  args: {
    title: 'Supercalifragilisticexpialidocious'.repeat(3),
    actions: <Button size="sm">Edit</Button>,
  },
  render: (args) => (
    <div data-testid="frame" style={{ width: '20rem' }}>
      <Card {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
    await expect(
      canvas.getByRole('heading', { level: 2 }).getBoundingClientRect().right,
    ).toBeLessThanOrEqual(frame.getBoundingClientRect().right)
    await expect(
      canvas.getByRole('button', { name: 'Edit' }).getBoundingClientRect().right,
    ).toBeLessThanOrEqual(frame.getBoundingClientRect().right)
  },
}
