import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Button } from '../Button/Button'
import { PageHeader } from './PageHeader'

/**
 * 모든 화면의 첫 줄 — 그 화면의 단 하나뿐인 `h1`, 한 줄 설명, 오른쪽 액션, 위쪽 `back` 자리(돌아가기 링크).
 * 좁은 화면에서는 액션이 제목 아래로 내려온다. Patterns 의 화면은 모두 이것으로 시작한다.
 */
const meta = {
  title: 'UI/PageHeader',
  component: PageHeader,
  args: { title: 'Notes', description: 'Everything you wrote, in one place.' },
} satisfies Meta<typeof PageHeader>
export default meta
type Story = StoryObj<typeof meta>

export const TitleAndDescription: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible()
    await expect(canvas.getByText('Everything you wrote, in one place.')).toBeVisible()
  },
}

export const WithActionsAndBack: Story = {
  args: {
    back: <a href="#notes">← All notes</a>,
    actions: (
      <>
        <Button variant="secondary">Export</Button>
        <Button>New note</Button>
      </>
    ),
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('link', { name: '← All notes' })).toBeVisible()
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: '← All notes' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Export' })).toHaveFocus()
    await expect(canvas.getByRole('button', { name: 'New note' })).toBeVisible()
  },
}

export const NarrowWrapsActions: Story = {
  args: { actions: <Button>New note</Button> },
  render: (args) => (
    <div style={{ width: '18rem' }}>
      <PageHeader {...args} title="A rather long page title that has to wrap" />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await expect(canvas.getByRole('button', { name: 'New note' })).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  args: { actions: <Button>New note</Button> },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await expect(canvas.getByRole('heading', { level: 1 })).toBeVisible()
  },
}
