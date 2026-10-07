import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { Avatar } from '../Avatar/Avatar'
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

/** `describedBy` — 메뉴 칸 밖의 설명(예: 폼의 오류 문장)이 버튼의 접근 가능한 설명으로 이어진다. 이름(`label`)은 그대로다 */
export const DescribedByTiesAnOutsideDescriptionToTheButton: Story = {
  args: { describedBy: 'row-menu-why' },
  render: (args) => (
    <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'start' }}>
      <RowMenu {...args} />
      <p id="row-menu-why">Pick one before sending.</p>
    </div>
  ),
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'More for Ada' })
    await expect(button).toHaveAccessibleDescription('Pick one before sending.')
  },
}

/** 루트 글자 크기 기준 rem → px */
const rem = (n: number) => parseFloat(getComputedStyle(document.documentElement).fontSize) * n
const veryLong = '가나다라마바사아자차카타파하'.repeat(10)

/** 긴 항목은(폭 상한 `min(24rem, 100vw − 여백)` — 시험 브라우저의 뷰포트에서는 24rem 이 상한이고, 320~414px 화면에서는 화면 폭 − 여백이 상한이다) **상자 안에서** 말줄임이다 — 항목이 상자 밖으로 밀려 나가거나 문서에 가로 스크롤이 생기지 않는다 */
/** 메뉴는 **내용에 맞춰** 넓어진다 — 짧은 메뉴는 최소폭(12rem), 34자 항목은 잘리지 않고 그만큼 넓어지며, 상한(24rem)을 넘는 것만 말줄임 */
export const MenuWidthFollowsItsContent: Story = {
  args: {
    items: [
      { key: 'edit', label: 'Edit', onSelect: fn() },
      { key: 'delete', label: 'Delete', onSelect: fn(), danger: true },
    ],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    const short = canvas.getByRole('menu').getBoundingClientRect()
    await expect(Math.abs(short.width - rem(12))).toBeLessThanOrEqual(1) // 짧은 내용 → 최소폭
  },
}

export const ThirtyFourCharacterItemIsShownInFull: Story = {
  args: {
    items: [{ key: 'mid', label: 'A thirty-four character menu item!', onSelect: fn() }],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    const menu = canvas.getByRole('menu').getBoundingClientRect()
    const label = canvas
      .getByRole('menuitem')
      .querySelector('span:not([aria-hidden])') as HTMLElement
    await expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth) // 잘리지 않았다
    await expect(menu.width).toBeGreaterThan(rem(12)) // 최소폭보다 넓어졌다
    await expect(menu.width).toBeLessThanOrEqual(rem(24) + 1)
  },
}

export const LongItemsAreEllipsizedInsideTheMenu: Story = {
  args: {
    items: [
      { key: 'long', label: veryLong, onSelect: fn(), checked: true },
      { key: 'short', label: 'Short', onSelect: fn(), checked: false },
    ],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    const menu = canvas.getByRole('menu')
    const item = canvas.getByRole('menuitemradio', { name: veryLong }) // 전체 글자가 낭독 이름
    const label = item.querySelector('span:not([aria-hidden])') as HTMLElement
    const box = menu.getBoundingClientRect()
    await expect(Math.abs(box.width - rem(24))).toBeLessThanOrEqual(1) // 내용이 길면 정확히 상한(24rem)까지 넓어진다
    await expect(box.right).toBeLessThanOrEqual(window.innerWidth)
    await expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(box.right + 1)
    await expect(item.getBoundingClientRect().width).toBeLessThanOrEqual(box.width)
    await expect(label.scrollWidth).toBeGreaterThan(label.clientWidth) // 실제로 잘렸다
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    ) // 문서 가로 스크롤 없음
  },
}

/** `content` — 보이는 모양을 직접 정한다: 이름은 말줄임, 꼬리표는 고정(잘리지 않는다). 이름(`label`)은 그대로 낭독 이름 */
export const ContentKeepsTheTagWhileTheNameIsEllipsized: Story = {
  args: {
    items: [
      {
        key: 'long',
        label: `${veryLong}#0042`,
        checked: true,
        onSelect: fn(),
        content: (
          <span style={{ display: 'flex', minWidth: 0, gap: 'var(--space-xs)' }}>
            <span
              data-testid="name"
              style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {veryLong}
            </span>
            <span data-testid="tag" style={{ flex: 'none' }}>
              #0042
            </span>
          </span>
        ),
      },
    ],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(trigger(canvas))
    const item = canvas.getByRole('menuitemradio', { name: `${veryLong}#0042` })
    const name = item.querySelector('[data-testid="name"]') as HTMLElement
    const tag = item.querySelector('[data-testid="tag"]') as HTMLElement
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth) // 이름은 잘렸고
    await expect(tag.scrollWidth).toBeLessThanOrEqual(tag.clientWidth) // 꼬리표는 온전하다
    await expect(tag.getBoundingClientRect().right).toBeLessThanOrEqual(
      canvas.getByRole('menu').getBoundingClientRect().right + 1,
    )
    await expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
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

/** 줄 밖의 일반 드롭다운으로도 쓴다 — 헤더 계정 메뉴: 글자 + 아바타 트리거, 시작 정렬(`align`), 하나 고르기 묶음 + 구분선 + 위험 항목 */
export const AccountMenuAlignedToTheStart: Story = {
  args: {
    label: 'Account menu',
    align: 'start',
    trigger: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <Avatar name="Ada Lovelace" size="sm" alt="" />
        Ada
      </span>
    ),
    items: [
      { key: 'profile', label: 'Profile', onSelect: fn() },
      { key: 'ko', label: '한국어', onSelect: fn(), checked: true, separatorBefore: true },
      { key: 'en', label: 'English', onSelect: fn(), checked: false },
      { key: 'out', label: 'Sign out', onSelect: fn(), danger: true, separatorBefore: true },
    ],
  },
  render: (args) => (
    <div style={{ paddingInlineStart: 'var(--space-3xl)' }}>
      <RowMenu {...args} />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Account menu' })
    await expect(button).toHaveTextContent('Ada')
    await userEvent.click(button)
    const menu = canvas.getByRole('menu', { name: 'Account menu' })
    await expect(menu).toHaveAttribute('data-align', 'start')
    await expect(
      Math.abs(menu.getBoundingClientRect().left - button.getBoundingClientRect().left),
    ).toBeLessThan(2)
    await expect(canvas.getByRole('menuitemradio', { name: '한국어' })).toBeChecked()
  },
}
