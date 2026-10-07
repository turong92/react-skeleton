import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { Button } from './Button'

/**
 * 모든 클릭 가능한 동작은 `<Button>` 이다(날 `<button>` 은 lint 가 막는다).
 * 기본은 `type="button"` — 폼 제출 버튼만 `type="submit"` 을 명시한다. 일하는 중에는 `loading`(누르지 못하고 스피너를 보인다).
 */
const meta = {
  title: 'UI/Button',
  component: Button,
  args: { children: 'Save', onClick: fn() },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'ghost', 'danger', 'link'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Save' })
    await expect(button).toHaveAttribute('type', 'button')
    await expect(button).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(button)
    await expect(args.onClick).toHaveBeenCalledTimes(1)
  },
}

export const Secondary: Story = { args: { variant: 'secondary' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const Link: Story = {
  args: { variant: 'link', children: 'Forgot your password?' },
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByRole('button')).textDecorationLine).toBe('underline')
  },
}

/** 눌리는 것은 쉬는 상태에서도 눌리는 것으로 보인다 — 글자만 있는 버튼은 없다(`link` 만 밑줄로 링크처럼) */
export const EveryVariantLooksPressableAtRest: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
      {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
        <Button key={variant} {...args} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    for (const name of ['primary', 'secondary', 'ghost', 'danger']) {
      const style = getComputedStyle(canvas.getByRole('button', { name }))
      const transparent = (c: string) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent'
      await expect(
        !transparent(style.borderTopColor) || !transparent(style.backgroundColor),
        name,
      ).toBe(true)
      await expect(style.cursor).toBe('pointer')
      await expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(44)
    }
  },
}
export const Danger: Story = { args: { variant: 'danger', children: 'Delete' } }

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
  play: async ({ canvas }) => {
    const height = (name: string) =>
      canvas.getByRole('button', { name }).getBoundingClientRect().height
    await expect(height('Small')).toBeLessThan(height('Medium'))
    await expect(height('Medium')).toBeLessThan(height('Large'))
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Save' })
    await expect(button).toBeDisabled()
    await userEvent.click(button)
    await expect(args.onClick).not.toHaveBeenCalled()
  },
}

export const Loading: Story = {
  args: { loading: true, loadingLabel: 'Saving' },
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: /Save/ })
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute('aria-busy', 'true')
    await expect(canvas.getByRole('status')).toHaveTextContent('Saving')
    await userEvent.click(button)
    await expect(args.onClick).not.toHaveBeenCalled()
  },
}

export const KeyboardOperation: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.tab()
    const button = canvas.getByRole('button', { name: 'Save' })
    await expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    await expect(args.onClick).toHaveBeenCalledTimes(2)
  },
}

export const FocusRing: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    const ring = getComputedStyle(canvas.getByRole('button', { name: 'Save' }))
    await expect(ring.outlineStyle).toBe('solid')
    await expect(parseFloat(ring.outlineWidth)).toBeGreaterThan(0)
  },
}

export const LongText: Story = {
  args: { children: 'Save all changes to every project in this workspace and notify the team' },
  render: (args) => (
    <div style={{ maxWidth: '16rem' }}>
      <Button {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button')
    await expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth)
  },
}
