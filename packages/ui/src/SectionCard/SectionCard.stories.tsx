import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn } from 'storybook/test'
import { SectionCard } from './SectionCard'

/**
 * 설정 · 긴 폼의 한 절 — 제목 · 설명 · 오른쪽 `aside` 와 본문. `id` 가 목차(`SectionIndex`)의 앵커이고 제목이 포커스를 받는다.
 * `collapsible` 이면 제목이 펼침 버튼(`aria-expanded` · `aria-controls`)이 되고, 접어도 본문은 마운트된 채 `hidden` 이라 입력 상태가 남는다.
 * 접힌 머리에는 `summary` 한 줄. 펼침은 `defaultExpanded`(비제어) 또는 `expanded` + `onToggle`(제어).
 */
const meta = {
  title: 'UI/SectionCard',
  component: SectionCard,
  args: {
    id: 'profile',
    title: 'Profile',
    description: 'How you appear to others',
    children: <p>Section body</p>,
  },
} satisfies Meta<typeof SectionCard>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    const section = canvas.getByRole('region', { name: 'Profile' })
    await expect(section).toHaveAttribute('id', 'profile')
    await expect(section).toHaveAccessibleDescription('How you appear to others')
    await expect(canvas.getByRole('heading', { level: 2, name: 'Profile' })).toBeVisible()
    await expect(canvas.getByText('Section body')).toBeVisible()
  },
}

export const WithAsideAndLevelThree: Story = {
  args: { headingLevel: 3, aside: <span>3 items</span> },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 3, name: 'Profile' })).toBeVisible()
    await expect(canvas.getByText('3 items')).toBeVisible()
  },
}

export const CollapsibleStartsExpanded: Story = {
  args: { collapsible: true, onToggle: fn() },
  play: async ({ canvas, args, userEvent }) => {
    const toggle = canvas.getByRole('button', { name: 'Profile' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByText('Section body')).toBeVisible()
    await userEvent.click(toggle)
    await expect(args.onToggle).toHaveBeenCalledWith(false)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.getByText('Section body')).not.toBeVisible()
    await userEvent.click(toggle)
    await expect(canvas.getByText('Section body')).toBeVisible()
  },
}

export const CollapsedShowsTheSummaryAndKeepsTheBodyMounted: Story = {
  args: {
    collapsible: true,
    defaultExpanded: false,
    summary: 'Ada Lovelace · English',
    children: <input aria-label="Display name" defaultValue="Ada" />,
  },
  play: async ({ canvas, userEvent }) => {
    const toggle = canvas.getByRole('button', { name: 'Profile' })
    await expect(toggle).toHaveAccessibleDescription('Ada Lovelace · English')
    await expect(canvas.getByText('Ada Lovelace · English')).toBeVisible()
    // 본문은 마운트된 채 숨김 — 펼치면 입력값이 그대로다
    await userEvent.click(toggle)
    await expect(canvas.getByLabelText('Display name')).toHaveValue('Ada')
    await expect(canvas.queryByText('Ada Lovelace · English')).toBeNull()
  },
}

export const KeyboardToggle: Story = {
  args: { collapsible: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    const toggle = canvas.getByRole('button', { name: 'Profile' })
    await expect(toggle).toHaveFocus()
    await expect(getComputedStyle(toggle).outlineStyle).toBe('solid')
    await userEvent.keyboard('{Enter}')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.keyboard(' ')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  },
}

function ControlledCard(args: ComponentProps<typeof SectionCard>) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <SectionCard {...args} collapsible expanded={expanded} onToggle={setExpanded} />
      <p>{expanded ? 'parent: open' : 'parent: closed'}</p>
    </>
  )
}

export const Controlled: Story = {
  render: (args) => <ControlledCard {...args} />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('parent: closed')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Profile' }))
    await expect(canvas.getByText('parent: open')).toBeVisible()
    await expect(canvas.getByText('Section body')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  args: { collapsible: true, defaultExpanded: false, summary: 'Ada Lovelace' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Profile' })).toBeVisible()
  },
}
