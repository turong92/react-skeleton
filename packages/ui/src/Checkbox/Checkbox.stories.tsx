import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { Checkbox } from './Checkbox'

/** 네이티브 체크박스 — 라벨 글자를 눌러도 토글되고 Space 로 조작한다. 설명 · 오류는 `aria-describedby` 로 이어진다. */
const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  args: { label: 'Accept the terms', onChange: fn() },
} satisfies Meta<typeof Checkbox>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const box = canvas.getByRole('checkbox', { name: 'Accept the terms' })
    await expect(box).not.toBeChecked()
    await userEvent.click(canvas.getByText('Accept the terms'))
    await expect(box).toBeChecked()
    await expect(args.onChange).toHaveBeenCalledTimes(1)
  },
}

export const KeyboardOperation: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    const box = canvas.getByRole('checkbox')
    await expect(box).toHaveFocus()
    await userEvent.keyboard(' ')
    await expect(box).toBeChecked()
    await userEvent.keyboard(' ')
    await expect(box).not.toBeChecked()
  },
}

export const FocusRing: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await expect(getComputedStyle(canvas.getByRole('checkbox')).outlineStyle).toBe('solid')
  },
}

export const Checked: Story = {
  args: { defaultChecked: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('checkbox')).toBeChecked()
  },
}

export const Indeterminate: Story = {
  args: { label: 'Select all', indeterminate: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('checkbox')).toBePartiallyChecked()
  },
}

export const WithDescription: Story = {
  args: { description: 'You can change this later in Settings' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('checkbox')).toHaveAccessibleDescription(
      'You can change this later in Settings',
    )
  },
}

export const WithError: Story = {
  args: { error: 'You must accept the terms to continue' },
  play: async ({ canvas }) => {
    const box = canvas.getByRole('checkbox')
    await expect(box).toHaveAttribute('aria-invalid', 'true')
    await expect(box).toHaveAccessibleDescription('You must accept the terms to continue')
    await expect(canvas.getByRole('alert')).toBeVisible()
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('checkbox'))
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}

export const LongLabel: Story = {
  args: {
    label:
      'I have read the terms of service and the privacy policy and I agree to both of them without any reservation whatsoever',
  },
  render: (args) => (
    <div style={{ maxWidth: '18rem' }}>
      <Checkbox {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await expect(canvas.getByRole('checkbox')).toBeVisible()
  },
}
