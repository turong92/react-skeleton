import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { Switch } from './Switch'

/** 켜짐/꺼짐 설정 — 즉시 적용되는 옵션에 쓴다(폼 제출로 모아 보내는 선택은 `Checkbox`). `role="switch"` 인 네이티브 체크박스라 Space 로 조작한다. */
const meta = {
  title: 'UI/Switch',
  component: Switch,
  args: { label: 'Email notifications', onChange: fn() },
} satisfies Meta<typeof Switch>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const toggle = canvas.getByRole('switch', { name: 'Email notifications' })
    await expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)
    await expect(toggle).toBeChecked()
    await expect(args.onChange).toHaveBeenCalledTimes(1)
  },
}

export const KeyboardOperation: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    const toggle = canvas.getByRole('switch')
    await expect(toggle).toHaveFocus()
    await expect(getComputedStyle(toggle).outlineStyle).toBe('solid')
    await userEvent.keyboard(' ')
    await expect(toggle).toBeChecked()
  },
}

export const On: Story = {
  args: { defaultChecked: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('switch')).toBeChecked()
  },
}

export const WithDescription: Story = {
  args: { description: 'A weekly summary, never more' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('switch')).toHaveAccessibleDescription(
      'A weekly summary, never more',
    )
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('switch'))
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}

export const LongLabel: Story = {
  args: {
    label: 'Send me an email whenever anything at all happens in any of my projects, day or night',
  },
  render: (args) => (
    <div style={{ maxWidth: '16rem' }}>
      <Switch {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await expect(canvas.getByRole('switch')).toBeVisible()
  },
}
