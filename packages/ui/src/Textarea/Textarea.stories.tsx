import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { Textarea } from './Textarea'

/** 여러 줄 입력. 라벨은 `<Field>` 가 이어 준다(Field 스토리 참고). 오류 표시는 `invalid`. */
const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  args: { 'aria-label': 'Message', onChange: fn() },
} satisfies Meta<typeof Textarea>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: 'Tell us more' },
  play: async ({ canvas, args, userEvent }) => {
    const box = canvas.getByRole('textbox', { name: 'Message' })
    await expect(box).toHaveAttribute('rows', '3')
    await userEvent.type(box, 'Hello{Enter}World')
    await expect(box).toHaveValue('Hello\nWorld')
    await expect(args.onChange).toHaveBeenCalled()
  },
}

export const Invalid: Story = {
  args: { invalid: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Read only for now' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox')).toBeDisabled()
  },
}

export const Taller: Story = {
  args: { rows: 8 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox')).toHaveAttribute('rows', '8')
  },
}

export const LongText: Story = {
  args: { defaultValue: 'word '.repeat(200) },
  render: (args) => (
    <div style={{ maxWidth: '20rem' }}>
      <Textarea {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const box = canvas.getByRole('textbox')
    await expect(box.getBoundingClientRect().width).toBeLessThanOrEqual(320)
  },
}
