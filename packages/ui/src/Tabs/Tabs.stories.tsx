import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'
import { nextTabId } from './tabKeys'
import { Tabs, type TabItem } from './Tabs'

/**
 * 탭 — WAI-ARIA 패턴. 선택된 탭만 Tab 키 순서에 들어가고(roving tabindex), 화살표 · Home · End 로 옮기면 바로 선택된다.
 * 탭 목록에는 이름이 필요하다(`aria-label`). 모든 패널은 마운트된 채 선택되지 않은 것만 `hidden`.
 */
const items: TabItem[] = [
  { id: 'overview', label: 'Overview', content: <p>Overview content</p> },
  { id: 'members', label: 'Members', content: <p>Members content</p> },
  { id: 'billing', label: 'Billing', content: <p>Billing content</p>, disabled: true },
  { id: 'settings', label: 'Settings', content: <p>Settings content</p> },
]

const meta = {
  title: 'UI/Tabs',
  component: Tabs,
  args: { items, 'aria-label': 'Project sections', onValueChange: fn() },
} satisfies Meta<typeof Tabs>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Overview content')
    await userEvent.click(canvas.getByRole('tab', { name: 'Members' }))
    await expect(canvas.getByRole('tab', { name: 'Members' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Members content')
    await expect(args.onValueChange).toHaveBeenCalledWith('members')
  },
}

export const ArrowKeysMoveAndSelect: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    const overview = canvas.getByRole('tab', { name: 'Overview' })
    await expect(overview).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(canvas.getByRole('tab', { name: 'Members' })).toHaveFocus()
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Members content')
    // 비활성 탭(Billing)은 건너뛴다
    await userEvent.keyboard('{ArrowRight}')
    await expect(canvas.getByRole('tab', { name: 'Settings' })).toHaveFocus()
    // 끝에서 처음으로 돌아간다
    await userEvent.keyboard('{ArrowRight}')
    await expect(overview).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    await expect(canvas.getByRole('tab', { name: 'Settings' })).toHaveFocus()
  },
}

export const HomeAndEnd: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await userEvent.keyboard('{End}')
    await expect(canvas.getByRole('tab', { name: 'Settings' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    await expect(canvas.getByRole('tab', { name: 'Overview' })).toHaveFocus()
  },
}

/** 탭 목록에서 Tab 키는 선택된 탭 하나에만 멈추고 곧바로 패널 밖으로 나간다 */
export const TabOrderSkipsUnselectedTabs: Story = {
  render: (args) => (
    <>
      <Tabs {...args} />
      <a href="#after">After the tabs</a>
    </>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await expect(canvas.getByRole('tab', { name: 'Overview' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'After the tabs' })).toHaveFocus()
    await expect(canvas.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toHaveLength(1)
  },
}

export const DisabledTabCannotBeSelected: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const billing = canvas.getByRole('tab', { name: 'Billing' })
    await expect(billing).toBeDisabled()
    await userEvent.click(billing)
    await expect(args.onValueChange).not.toHaveBeenCalled()
  },
}

export const FocusRing: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await expect(getComputedStyle(canvas.getByRole('tab', { name: 'Overview' })).outlineStyle).toBe(
      'solid',
    )
  },
}

export const DefaultValue: Story = {
  args: { defaultValue: 'settings' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Settings content')
  },
}

function ControlledDemo() {
  const [value, setValue] = useState('members')
  return (
    <>
      <p>Selected: {value}</p>
      <Tabs items={items} aria-label="Controlled" value={value} onValueChange={setValue} />
    </>
  )
}

export const Controlled: Story = {
  render: () => <ControlledDemo />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('Selected: members')).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'Settings' }))
    await expect(canvas.getByText('Selected: settings')).toBeVisible()
  },
}

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical')
    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}')
    await expect(canvas.getByRole('tab', { name: 'Members' })).toHaveFocus()
  },
}

export const ManyTabs: Story = {
  args: {
    items: Array.from({ length: 14 }, (_, i) => ({
      id: `t${i}`,
      label: `Section number ${i + 1}`,
      content: <p>Content {i + 1}</p>,
    })),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('tab')).toHaveLength(14)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}

/** `nextTabId` — 키보드 이동의 순수 규칙(비활성 건너뛰기 · 끝에서 돌아가기 · 방향별 키) */
export const NextTabIdRule: Story = {
  render: () => <p>nextTabId(items, id, key, orientation) → next id or null</p>,
  play: async () => {
    await expect(nextTabId(items, 'overview', 'ArrowRight', 'horizontal')).toBe('members')
    await expect(nextTabId(items, 'members', 'ArrowRight', 'horizontal')).toBe('settings')
    await expect(nextTabId(items, 'settings', 'ArrowRight', 'horizontal')).toBe('overview')
    await expect(nextTabId(items, 'overview', 'ArrowDown', 'horizontal')).toBeNull()
    await expect(nextTabId(items, 'overview', 'ArrowDown', 'vertical')).toBe('members')
    await expect(nextTabId(items, 'members', 'End', 'horizontal')).toBe('settings')
  },
}
