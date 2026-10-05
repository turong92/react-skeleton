import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Badge } from './Badge'

/** 상태 알약 — 뜻은 색이 아니라 글자로 전한다(색은 거들 뿐). 한 단어 · 짧은 구절만. */
const meta = {
  title: 'UI/Badge',
  component: Badge,
  args: { children: 'Draft' },
} satisfies Meta<typeof Badge>
export default meta
type Story = StoryObj<typeof meta>

export const Neutral: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Draft')).toHaveAttribute('data-tone', 'neutral')
  },
}

export const Tones: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
      <Badge>Neutral</Badge>
      <Badge tone="info">Info</Badge>
      <Badge tone="success">Active</Badge>
      <Badge tone="warning">Pending</Badge>
      <Badge tone="danger">Failed</Badge>
    </div>
  ),
  play: async ({ canvas }) => {
    for (const [name, tone] of [
      ['Neutral', 'neutral'],
      ['Info', 'info'],
      ['Active', 'success'],
      ['Pending', 'warning'],
      ['Failed', 'danger'],
    ])
      await expect(canvas.getByText(name)).toHaveAttribute('data-tone', tone)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: Tones.render,
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await expect(canvas.getByText('Failed')).toBeVisible()
  },
}
