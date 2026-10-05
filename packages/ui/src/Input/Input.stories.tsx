import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { Field } from '../Field/Field'
import { Input } from './Input'

/** 한 줄 입력. 라벨이 필요하니 보통 `<Field>` 안에서 쓴다(Field 스토리 참고). 오류 표시는 `invalid`. */
const meta = {
  title: 'UI/Input',
  component: Input,
  args: { 'aria-label': 'Name', onChange: fn() },
} satisfies Meta<typeof Input>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: 'Your name' },
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Name' })
    await expect(input).toHaveAttribute('type', 'text')
    await userEvent.type(input, 'Sumin')
    await expect(input).toHaveValue('Sumin')
    await expect(args.onChange).toHaveBeenCalledTimes(5)
  },
}

export const Invalid: Story = {
  args: { invalid: true, defaultValue: 'not-an-email' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Locked' },
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('textbox')
    await expect(input).toBeDisabled()
    await userEvent.type(input, 'x')
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}

export const Password: Story = {
  args: { type: 'password', 'aria-label': 'Password' },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Password')).toHaveAttribute('type', 'password')
  },
}

export const FocusRing: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    const input = canvas.getByRole('textbox')
    await expect(input).toHaveFocus()
    await expect(getComputedStyle(input).outlineStyle).toBe('solid')
  },
}

export const LongValue: Story = {
  args: {
    defaultValue: 'a-very-long-value-that-does-not-fit-in-a-narrow-input-field-at-all-1234567890',
  },
  render: (args) => (
    <div style={{ maxWidth: '12rem' }}>
      <Input {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole('textbox')
    await expect(input.getBoundingClientRect().width).toBeLessThanOrEqual(192)
  },
}

export const InsideField: Story = {
  render: () => (
    <Field label="Display name" hint="Shown on your profile">
      {(control) => <Input {...control} />}
    </Field>
  ),
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText('Display name')
    await userEvent.type(input, 'Sumin')
    await expect(input).toHaveAccessibleDescription('Shown on your profile')
  },
}
