import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { RowMenu } from './RowMenu'

/**
 * 목록 줄 · 카드 머리의 「⋯ 더보기」 메뉴 — WAI-ARIA 메뉴 버튼. 버튼 이름(`label`)에 줄을 가리키는 말을 넣는다(「Ada 더보기」).
 * 열면 첫 항목에 포커스(↑ 로 열면 마지막), ↑↓ Home End 로 옮기고(끝에서 돈다) Esc · 항목 고르기 · Tab 은 닫고 버튼으로 돌아가며, 바깥을 누르면 닫는다.
 * 잠긴 항목 · 잠긴 메뉴는 포커스는 받되 실행되지 않는다. 글자는 모두 prop 이다.
 */
const onEdit = fn()
const onDelete = fn()
const meta = {
  title: 'UI/RowMenu',
  component: RowMenu,
  args: {
    label: 'More for Ada',
    items: [
      { key: 'edit', label: 'Edit', onSelect: onEdit },
      { key: 'archive', label: 'Archive', onSelect: fn(), disabled: true },
      { key: 'delete', label: 'Delete', onSelect: onDelete, danger: true, separatorBefore: true },
    ],
  },
  beforeEach: () => {
    onEdit.mockClear()
    onDelete.mockClear()
  },
  render: (args) => (
    <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'start' }}>
      <RowMenu {...args} />
      <button type="button">Outside</button>
    </div>
  ),
} satisfies Meta<typeof RowMenu>
export default meta
type Story = StoryObj<typeof meta>

const trigger = (canvas: { getByRole: (r: 'button', o: { name: string }) => HTMLElement }) =>
  canvas.getByRole('button', { name: 'More for Ada' })

export const OpenAndPick: Story = {
  play: async ({ canvas, userEvent }) => {
    const button = trigger(canvas)
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    const menu = canvas.getByRole('menu', { name: 'More for Ada' })
    await expect(menu).toBeVisible()
    await expect(canvas.getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Edit' }))
    await expect(onEdit).toHaveBeenCalledTimes(1)
    await expect(canvas.queryByRole('menu')).toBeNull()
    await expect(button).toHaveFocus()
  },
}

export const ArrowKeysWrapAndHomeEndJump: Story = {
  args: {
    items: [
      { key: 'a', label: 'One', onSelect: fn() },
      { key: 'b', label: 'Two', onSelect: fn() },
      { key: 'c', label: 'Three', onSelect: fn() },
    ],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    await expect(canvas.getByRole('menuitem', { name: 'One' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(canvas.getByRole('menuitem', { name: 'Two' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    await expect(canvas.getByRole('menuitem', { name: 'One' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    await expect(canvas.getByRole('menuitem', { name: 'Three' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    await expect(canvas.getByRole('menuitem', { name: 'One' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    await expect(canvas.getByRole('menuitem', { name: 'Three' })).toHaveFocus()
  },
}

export const KeyboardOpensFromTheButton: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    const button = trigger(canvas)
    await expect(button).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(canvas.getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect(button).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    await expect(canvas.getByRole('menuitem', { name: 'Delete' })).toHaveFocus()
  },
}

export const EnterPicksTheFocusedItem: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(onEdit).toHaveBeenCalledTimes(1)
    await expect(trigger(canvas)).toHaveFocus()
  },
}

export const EscapeClosesAndReturnsFocus: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    await userEvent.keyboard('{Escape}')
    await expect(canvas.queryByRole('menu')).toBeNull()
    await expect(trigger(canvas)).toHaveFocus()
    await expect(trigger(canvas)).toHaveAttribute('aria-expanded', 'false')
  },
}

export const OutsideClickCloses: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    await expect(canvas.getByRole('menu')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Outside' }))
    await expect(canvas.queryByRole('menu')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Outside' })).toHaveFocus()
  },
}

export const TabClosesAndMovesOn: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    await userEvent.tab()
    await expect(canvas.queryByRole('menu')).toBeNull()
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Outside' })).toHaveFocus())
  },
}

export const DisabledItemTakesFocusButDoesNothing: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    await userEvent.keyboard('{ArrowDown}')
    const archive = canvas.getByRole('menuitem', { name: 'Archive' })
    await expect(archive).toHaveFocus()
    await expect(archive).toHaveAttribute('aria-disabled', 'true')
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByRole('menu')).toBeVisible()
  },
}

export const DangerItemAfterASeparator: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    await expect(canvas.getByRole('separator')).toBeVisible()
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Delete' }))
    await expect(onDelete).toHaveBeenCalledTimes(1)
  },
}

export const ChoosingOneOfSeveral: Story = {
  args: {
    items: [
      { key: 'system', label: 'System', onSelect: fn(), checked: true },
      { key: 'light', label: 'Light', onSelect: fn(), checked: false },
      { key: 'dark', label: 'Dark', onSelect: fn(), checked: false },
    ],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    await expect(canvas.getByRole('menuitemradio', { name: 'System' })).toBeChecked()
    await expect(canvas.getByRole('menuitemradio', { name: 'Light' })).not.toBeChecked()
  },
}

export const DisabledMenuDoesNotOpenButKeepsFocus: Story = {
  args: { disabled: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    const button = trigger(canvas)
    await expect(button).toHaveFocus()
    await userEvent.click(button)
    await userEvent.keyboard('{ArrowDown}')
    await expect(canvas.queryByRole('menu')).toBeNull()
    await expect(button).toHaveAttribute('aria-disabled', 'true')
  },
}

export const CustomTrigger: Story = {
  args: { label: 'Share options', trigger: 'Share' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Share options' })).toHaveTextContent('Share')
  },
}

export const OpensUpwardWhenThereIsNoRoomBelow: Story = {
  render: (args) => (
    <div
      style={{ position: 'fixed', bottom: 'var(--space-md)', insetInlineStart: 'var(--space-md)' }}
    >
      <RowMenu {...args} />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    const menu = canvas.getByRole('menu')
    await expect(menu).toHaveAttribute('data-placement', 'top')
    const rect = menu.getBoundingClientRect()
    await expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight)
  },
}

export const StaysInsideTheViewportAtTheLeftEdge: Story = {
  play: async ({ canvas, userEvent }) => {
    // 이 스토리의 버튼은 화면 왼쪽 끝 — 오른쪽 끝 정렬 그대로면 메뉴가 왼쪽 밖으로 잘린다
    await userEvent.click(trigger(canvas))
    const rect = canvas.getByRole('menu').getBoundingClientRect()
    await expect(rect.left).toBeGreaterThanOrEqual(0)
    await expect(canvas.getByRole('menu')).toHaveAttribute('data-align', 'start')
  },
}

export const KeepsEndAlignmentWhenThereIsRoomOnTheLeft: Story = {
  render: (args) => (
    <div style={{ display: 'flex', justifyContent: 'end' }}>
      <RowMenu {...args} />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    const menu = canvas.getByRole('menu')
    await expect(menu).toHaveAttribute('data-align', 'end')
    await expect(menu.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    await expect(canvas.getByRole('menu')).toBeVisible()
  },
}
