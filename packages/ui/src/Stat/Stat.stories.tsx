import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Stat } from './Stat'

/** 대시보드의 숫자 한 칸 — 라벨 · 큰 숫자 · 보조 설명. 낭독기에는 「라벨: 값」으로 읽힌다. 여러 칸은 호출하는 쪽이 격자로 놓는다. */
const meta = {
  title: 'UI/Stat',
  component: Stat,
  args: { label: 'Notes', value: 12, hint: '3 pinned' },
} satisfies Meta<typeof Stat>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Notes')).toBeVisible()
    await expect(canvas.getByText('12')).toBeVisible()
    await expect(canvas.getByText('3 pinned')).toBeVisible()
  },
}

export const Grid: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 'var(--space-md)',
        gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
      }}
    >
      <Stat label="Notes" value={12} hint="3 pinned" />
      <Stat label="Active" value={7} tone="accent" />
      <Stat label="Drafts" value={4} tone="warning" hint="Finish them" />
      <Stat label="With files" value={0} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('term')).toHaveLength(4)
    await expect(canvas.getByText('Drafts').closest('dl')).toHaveAttribute('data-tone', 'warning')
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: Grid.render,
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('term')).toHaveLength(4)
  },
}
