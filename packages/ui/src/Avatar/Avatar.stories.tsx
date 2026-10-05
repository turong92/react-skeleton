import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { Avatar } from './Avatar'

/**
 * 사람 아바타 — 사진, 없거나 불러오지 못하면 머리글자(같은 이름은 늘 같은 색). 이름은 항상 접근 가능한 이름이다.
 * 옆에 이름 글자가 이미 보이면 `alt=""` 로 중복 낭독을 피한다.
 */
const meta = {
  title: 'UI/Avatar',
  component: Avatar,
  args: { name: 'Ada Lovelace' },
} satisfies Meta<typeof Avatar>
export default meta
type Story = StoryObj<typeof meta>

const pixel =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="gray"/></svg>'

export const Initials: Story = {
  play: async ({ canvas }) => {
    const avatar = canvas.getByRole('img', { name: 'Ada Lovelace' })
    await expect(avatar).toHaveTextContent('AL')
  },
}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
      <Avatar name="김수민" size="sm" />
      <Avatar name="Grace Hopper" />
      <Avatar name="Linus" size="lg" />
      <Avatar name="Margaret Hamilton" size="lg" />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('img')).toHaveLength(4)
    await expect(canvas.getByRole('img', { name: '김수민' })).toHaveTextContent('김')
  },
}

export const WithPicture: Story = {
  args: { src: pixel },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Ada Lovelace' })).toHaveAttribute('src', pixel)
  },
}

export const BrokenPictureFallsBackToInitials: Story = {
  args: { src: 'http://127.0.0.1:1/missing.png' },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL'),
    )
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Ada Lovelace' })).toBeVisible()
  },
}
