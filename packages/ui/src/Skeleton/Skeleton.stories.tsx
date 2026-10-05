import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Skeleton } from './Skeleton'

/**
 * 로딩 자리표시 — 내용이 올 자리의 모양을 미리 잡는다. 스크린리더에는 `label` 한 줄만 읽히고(`role="status"`), 모양은 숨는다.
 * 목록 · 카드가 불러오는 동안 `Spinner` 대신(자리가 튀지 않는다). 움직임 줄이기 설정이면 멈춘다.
 */
const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  args: { label: 'Loading notes' },
} satisfies Meta<typeof Skeleton>
export default meta
type Story = StoryObj<typeof meta>

export const TextLines: Story = {
  args: { lines: 3 },
  play: async ({ canvas }) => {
    const status = canvas.getByRole('status')
    await expect(status).toHaveTextContent('Loading notes')
    await expect(status).toHaveAttribute('aria-busy', 'true')
    await expect(status.querySelectorAll('[data-shape="text"]')).toHaveLength(3)
  },
}

export const CardPlaceholder: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
      <Skeleton shape="circle" label="Loading avatar" />
      <div style={{ flex: 1 }}>
        <Skeleton lines={2} label="Loading profile" />
      </div>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('status')).toHaveLength(2)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  args: { lines: 2 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toBeVisible()
  },
}
