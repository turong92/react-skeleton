import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { ReactionBar } from './ReactionBar'

/**
 * 반응 줄 — 서버가 알려 주는 반응 종류(`types`)를 그대로 그린다. 종류를 더해도(공감 …) 코드는 그대로고,
 * 문구 · 아이콘만 `labels` · `icons` 맵으로 준다(맵에 없으면 코드가 글자가 된다). 누른 것은 `aria-pressed`, 묶음은 `role="group"`.
 * `onToggle(type, active)` 의 `active` 는 누른 뒤의 상태.
 */
const meta = {
  title: 'Packages/board/ReactionBar',
  component: ReactionBar,
  args: {
    types: ['LIKE', 'DISLIKE'],
    counts: { LIKE: 3, DISLIKE: 1 },
    mine: ['LIKE'],
    onToggle: fn(),
  },
} satisfies Meta<typeof ReactionBar>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('group', { name: 'Reactions' })).toBeVisible()
    const like = canvas.getByRole('button', { name: 'LIKE 3' })
    await expect(like).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByRole('button', { name: 'DISLIKE 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'DISLIKE 1' }))
    await expect(args.onToggle).toHaveBeenLastCalledWith('DISLIKE', true)
    await userEvent.click(like)
    await expect(args.onToggle).toHaveBeenLastCalledWith('LIKE', false)
  },
}

/** 프로젝트가 「공감」을 더하는 방법 — 서버 설정에 `EMPATHY` 를 더하고, 여기서는 맵 두 개만 넘긴다 */
export const ExtraTypeWithLabelMap: Story = {
  args: {
    types: ['LIKE', 'DISLIKE', 'EMPATHY'],
    counts: { LIKE: 3, DISLIKE: 1, EMPATHY: 7 },
    mine: ['EMPATHY'],
    labels: { LIKE: '좋아요', DISLIKE: '싫어요', EMPATHY: '공감' },
    icons: { LIKE: '👍', DISLIKE: '👎', EMPATHY: '🤝' },
    groupLabel: '반응',
  },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('group', { name: '반응' })).toBeVisible()
    await expect(canvas.getAllByRole('button')).toHaveLength(3)
    const empathy = canvas.getByRole('button', { name: '공감 7' }) // 이모지는 낭독에서 빠진다
    await expect(empathy).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByText('🤝')).toHaveAttribute('aria-hidden', 'true')
    await userEvent.click(canvas.getByRole('button', { name: '좋아요 3' }))
    await expect(args.onToggle).toHaveBeenCalledWith('LIKE', true)
  },
}

export const UnknownTypeFallsBackToItsCode: Story = {
  args: { types: ['LAUGH'], counts: {}, mine: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'LAUGH 0' })).toBeVisible()
  },
}

export const KeyboardOnly: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'LIKE 3' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'DISLIKE 1' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onToggle).toHaveBeenLastCalledWith('DISLIKE', true)
    await userEvent.keyboard(' ')
    await expect(args.onToggle).toHaveBeenCalledTimes(2)
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('button', { name: 'LIKE 3' })).toBeDisabled()
    await userEvent.click(canvas.getByRole('button', { name: 'DISLIKE 1' }))
    await expect(args.onToggle).not.toHaveBeenCalled()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await expect(canvas.getByRole('button', { name: 'LIKE 3' })).toBeVisible()
  },
}
